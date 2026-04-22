use epub::doc::EpubDoc;
use std::path::Path;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct EpubMetadata {
    pub title: String,
    pub author: String,
    pub cover_image: Option<Vec<u8>>, // Base64 encoded in frontend usually, but raw bytes here
}

fn get_mime_type(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg".to_string()
    } else if lower.ends_with(".png") {
        "image/png".to_string()
    } else if lower.ends_with(".gif") {
        "image/gif".to_string()
    } else if lower.ends_with(".svg") {
        "image/svg+xml".to_string()
    } else if lower.ends_with(".webp") {
        "image/webp".to_string()
    } else {
        "image/jpeg".to_string()
    }
}

pub fn read_epub_metadata<P: AsRef<Path>>(path: P) -> Option<EpubMetadata> {
    let mut doc = EpubDoc::new(path).ok()?;
    
    let title = doc.mdata("title").map(|s| s.value.clone()).unwrap_or_else(|| "Unknown Title".to_string());
    let author = doc.mdata("creator").map(|s| s.value.clone()).unwrap_or_else(|| "Unknown Author".to_string());
    
    let cover_image = doc.get_cover().map(|(data, _mime)| data);

    Some(EpubMetadata {
        title,
        author,
        cover_image,
    })
}

use regex::Regex;
use base64::{Engine as _, engine::general_purpose};
extern crate urlencoding;

pub fn get_chapter<P: AsRef<Path>>(path: P, index: usize) -> Option<(String, usize)> {
    let mut doc = EpubDoc::new(path).ok()?;
    let spine_len = doc.spine.len();
    if index >= spine_len {
        return None;
    }
    
    // Set current page to index
    if !doc.set_current_chapter(index) {
        return None; 
    }
    
    // Get chapter path to resolve relative image paths
    let chapter_path = doc.get_current_path()?;
    let chapter_dir = Path::new(&chapter_path).parent();

    // Get content (returns (mime, content))
    let (s1, s2) = doc.get_current_str()?;
    
    // Heuristic: The content is usually larger, or contains HTML tags.
    let content = if s1.len() > s2.len() || s1.contains("<html") || s1.contains("<div") {
        s1
    } else {
        s2
    };

    // URL decode helper
    fn decode_url(s: &str) -> String {
        urlencoding::decode(s).map(|d| d.into_owned()).unwrap_or_else(|_| s.to_string())
    }

    // Process images (case-insensitive attributes, handles src, xlink:href, and plain href for images)
    // We target common patterns: src="..." , xlink:href="..." , href="..."
    let re = Regex::new(r#"(?i)(src|href|xlink:href)\s*=\s*(["'])([^"']+)(["'])"#).ok()?;
    
    let mut final_content = content.clone();
    
    // We'll collect all distinct matches to avoid multiple replacements of the same string
    let mut matches = Vec::new();
    for cap in re.captures_iter(&content) {
        let attr_name = cap[1].to_string();
        let quote = cap[2].to_string();
        let original_src = cap[3].to_string();
        matches.push((attr_name, quote, original_src));
    }

    // Deduplicate to avoid redundant processing
    matches.sort_by(|a, b| a.2.cmp(&b.2));
    matches.dedup_by(|a, b| a.2 == b.2);

    for (attr_name, quote, original_src) in matches {
        if original_src.starts_with("http") || original_src.starts_with("data:") {
            continue;
        }

        let decoded_src = decode_url(&original_src);
        
        let resource_path = if decoded_src.starts_with('/') {
            decoded_src[1..].to_string()
        } else if let Some(dir) = chapter_dir {
            let mut resolved = dir.to_path_buf();
            for part in decoded_src.split('/') {
                if part == ".." {
                    resolved.pop();
                } else if part != "." {
                    resolved.push(part);
                }
            }
            resolved.to_string_lossy().replace('\\', "/")
        } else {
            decoded_src.to_string()
        };

        let mime = get_mime_type(&resource_path);

        // Try to get resource by resolved path, fallback to decoded src, then original src
        if let Some(img_bytes) = doc.get_resource_by_path(&resource_path)
            .or_else(|| doc.get_resource_by_path(&decoded_src))
            .or_else(|| doc.get_resource_by_path(&original_src)) 
        {
            let b64 = general_purpose::STANDARD.encode(&img_bytes);
            let data_uri = format!("data:{};base64,{}", mime, b64);
            
            // Replace all occurrences of this specific attribute+path combination
            // We use a regex for the specific replacement to handle the original case/spacing exactly
            let pattern = format!(r#"(?i){}\s*=\s*["']{}["']"#, regex::escape(&attr_name), regex::escape(&original_src));
            if let Ok(rep_re) = Regex::new(&pattern) {
                let replacement = format!("{}={}{}{}", attr_name, quote, data_uri, quote);
                final_content = rep_re.replace_all(&final_content, replacement.as_str()).into_owned();
            }
        }
    }
    
    Some((final_content, spine_len))
}

