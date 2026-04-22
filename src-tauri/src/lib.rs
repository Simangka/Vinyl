mod database;
mod epub_utils;
mod ai_service;

use database::{Database, Book, Highlight, Note, AIMessage, WorkspaceFile, FileTemplate};
use std::sync::Mutex;
use tauri::{Manager, State, Emitter};
use serde::{Serialize, Deserialize};
use std::path::Path;
use notify::{Watcher, RecursiveMode, Config};
use std::process::Command;
use walkdir::WalkDir;

// Global state to store the active watcher for the workspace
pub struct AppState {
    pub current_watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_library(db: State<Mutex<Database>>) -> Result<Vec<Book>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_all_books().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_book(file_path: String, db: State<Mutex<Database>>) -> Result<Book, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    
    if db_guard.exists_by_path(&file_path).map_err(|e| e.to_string())? {
        return Err("Book already exists in library".to_string());
    }

    let path = Path::new(&file_path);
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();

    let id = uuid::Uuid::new_v4().to_string();
    let mut book = Book {
        id: id.clone(),
        title: file_name.clone(),
        author: "Unknown".to_string(),
        file_path: file_path.clone(),
        cover_image: None,
        format: extension.clone(),
        page_count: None,
    };

    if extension == "epub" {
        if let Some(metadata) = epub_utils::read_epub_metadata(&file_path) {
            book.title = metadata.title;
            book.author = metadata.author;
            book.cover_image = metadata.cover_image;
        }
    } 
    // PDF metadata extraction to be added later if needed

    db_guard.insert_book(&book).map_err(|e| e.to_string())?;
    
    Ok(book)
}

#[tauri::command]
fn read_book_file(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_epub_chapter(file_path: String, index: usize) -> Result<(String, usize), String> {
    epub_utils::get_chapter(&file_path, index)
        .ok_or_else(|| "Failed to read chapter".to_string())
}

#[tauri::command]
fn delete_book(id: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.delete_book_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_highlight(highlight: Highlight, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.add_highlight(&highlight).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_highlights(book_id: String, db: State<Mutex<Database>>) -> Result<Vec<Highlight>, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.get_highlights(&book_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_highlight(id: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.delete_highlight(&id).map_err(|e| e.to_string())
}

// AI Commands
#[derive(serde::Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: serde_json::Value,
}

#[tauri::command]
async fn ask_ai(
    db: State<'_, Mutex<Database>>,
    book_id: String,
    model: String,
    api_key: String,
    messages: Vec<ChatMessage>,
    selected_text: Option<String>,
) -> Result<String, String> {
    // 1. Convert to OpenRouterMessage
    let api_messages: Vec<ai_service::OpenRouterMessage> = messages
        .iter()
        .map(|m| ai_service::OpenRouterMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    // 2. Call AI Service
    let response_content = ai_service::call_ai_api(api_key, model, api_messages, selected_text.clone())
        .await
        .map_err(|e| e.to_string())?;

    // 2. Save conversation to DB
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    
    // Check if conversation exists for book, else create
    let conversations = db_guard.get_conversations(&book_id).map_err(|e| e.to_string())?;
    let conversation_id = if let Some(conv) = conversations.first() {
        conv.id
    } else {
        db_guard.create_conversation(&book_id).map_err(|e| e.to_string())?
    };

    // Save User Message
    if let Some(last_msg) = messages.last() {
        if last_msg.role == "user" {
             // For DB storage, just stringify the complex content
             let content_str = if last_msg.content.is_string() {
                 last_msg.content.as_str().unwrap_or("").to_string()
             } else {
                 last_msg.content.to_string()
             };
             
             db_guard.add_ai_message(&AIMessage {
                id: 0, // Auto-increment
                conversation_id,
                role: "user".to_string(),
                content: content_str,
                selected_text: selected_text.clone(),
                timestamp: "".to_string(), // Default in DB
            }).map_err(|e| e.to_string())?;
        }
    }

    // Save AI Response
    db_guard.add_ai_message(&AIMessage {
        id: 0,
        conversation_id,
        role: "assistant".to_string(),
        content: response_content.clone(),
        selected_text: None,
        timestamp: "".to_string(),
    }).map_err(|e| e.to_string())?;

    Ok(response_content)
}

#[tauri::command]
async fn execute_agent_command(command: String, args: Vec<String>, path: Option<String>) -> Result<String, String> {
    let mut cmd = Command::new(command);
    cmd.args(args);
    
    if let Some(p) = path {
        if !p.is_empty() {
            cmd.current_dir(p);
        }
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn agent_grep(pattern: String, path: String) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    let walker = WalkDir::new(path).into_iter();
    
    for entry in walker.filter_map(|e: Result<walkdir::DirEntry, walkdir::Error>| e.ok()) {
        if entry.file_type().is_file() {
            let content = std::fs::read_to_string(entry.path()).unwrap_or_default();
            for (line_num, line) in content.lines().enumerate() {
                if line.contains(&pattern) {
                    results.push(format!("{}:{}: {}", entry.path().display(), line_num + 1, line.trim()));
                }
            }
        }
        if results.len() > 100 { break; } // Safety limit
    }
    
    Ok(results)
}

#[tauri::command]
async fn agent_list_files(path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;
    
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        files.push(if is_dir { format!("{}/", name) } else { name });
    }
    
    Ok(files)
}

#[tauri::command]
fn get_ai_history(book_id: String, db: State<Mutex<Database>>) -> Result<Vec<AIMessage>, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conversations = db_guard.get_conversations(&book_id).map_err(|e| e.to_string())?;
    
    if let Some(conv) = conversations.first() {
        db_guard.get_ai_messages(conv.id).map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}


#[tauri::command]
fn clear_ai_history(book_id: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conversations = db_guard.get_conversations(&book_id).map_err(|e| e.to_string())?;
    
    if let Some(conv) = conversations.first() {
        db_guard.clear_conversation(conv.id).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn save_note(book_id: Option<String>, content: String, location: Option<String>, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    db_guard.add_note(&Note {
        id,
        book_id,
        content,
        location,
        created_at: "".to_string(),
    }).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_notes(book_id: String, db: State<Mutex<Database>>) -> Result<Vec<Note>, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.get_notes(&book_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(id: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.delete_note(&id).map_err(|e| e.to_string())
}

// Settings Commands
#[tauri::command]
fn save_preference(key: String, value: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.save_preference(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_preference(key: String, db: State<Mutex<Database>>) -> Result<Option<String>, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.get_preference(&key).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub extension: Option<String>,
}

#[tauri::command]
fn list_workspace_files(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path_buf = entry.path();
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path_buf.to_string_lossy().to_string(),
            is_dir: path_buf.is_dir(),
            extension: path_buf.extension().map(|e| e.to_string_lossy().to_string()),
        });
    }
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    Ok(entries)
}

#[tauri::command]
fn create_workspace_item(path: String, is_dir: bool, content: Option<String>) -> Result<(), String> {
    let path = Path::new(&path);
    if is_dir {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    } else {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(path, content.unwrap_or_default()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_workspace_file(path: String, db: State<Mutex<Database>>) -> Result<(String, Option<WorkspaceFile>), String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let metadata = db_guard.get_workspace_file_metadata(&path).map_err(|e| e.to_string())?;
    Ok((content, metadata))
}

#[tauri::command]
fn save_workspace_file(path: String, content: String, cursor_pos: Option<i32>, scroll_pos: Option<i32>, db: State<Mutex<Database>>) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    
    let path_buf = Path::new(&path);
    let extension = path_buf.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
    
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.save_workspace_file_metadata(&WorkspaceFile {
        id: None,
        path,
        file_type: extension,
        last_cursor_position: cursor_pos,
        last_scroll_position: scroll_pos,
        updated_at: "".to_string(),
    }).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_workspace_item(path: String, db: State<Mutex<Database>>) -> Result<(), String> {
    let path_buf = Path::new(&path);
    if path_buf.is_dir() {
        std::fs::remove_dir_all(path_buf).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(path_buf).map_err(|e| e.to_string())?;
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard.delete_workspace_file_metadata(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn rename_workspace_item(old_path: String, new_path: String, db: State<Mutex<Database>>) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    // If it's a file, migrate metadata
    if let Some(mut metadata) = db_guard.get_workspace_file_metadata(&old_path).map_err(|e| e.to_string())? {
        metadata.path = new_path;
        db_guard.delete_workspace_file_metadata(&old_path).map_err(|e| e.to_string())?;
        db_guard.save_workspace_file_metadata(&metadata).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_workspace_templates(db: State<Mutex<Database>>) -> Result<Vec<FileTemplate>, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    db_guard.get_templates().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd"])
            .current_dir(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // For other OS, we could try common terminal emulators, but the user is on Windows.
        return Err("Unsupported OS for terminal command".to_string());
    }
    Ok(())
}

#[tauri::command]
fn opencode(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Use '/k' to keep the terminal open after the command runs
        // This allows the user to see the output and interact with the agent coder.
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", "opencode", "."])
            .current_dir(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Unsupported OS for opencode command".to_string());
    }
    Ok(())
}

#[tauri::command]
fn watch_workspace(app: tauri::AppHandle, path: String, state: State<AppState>) -> Result<(), String> {
    let mut watcher_guard = state.current_watcher.lock().map_err(|e| e.to_string())?;
    
    // Stop old watcher if any
    *watcher_guard = None;

    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = notify::RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;
    watcher.watch(Path::new(&path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);

    // Spawn a thread to handle events and emit to frontend
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    // Emit a generic workspace-changed event
                    // We could be more specific but this is enough to trigger a refresh
                    let _ = app_handle.emit("workspace-changed", event.paths);
                }
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            current_watcher: Mutex::new(None),
        })
        .setup(|app| {
            let db = Database::new(app.handle());
            app.manage(Mutex::new(db));
            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, get_library, add_book, read_book_file, get_epub_chapter, delete_book,
            add_highlight, get_highlights, delete_highlight,
            ask_ai, get_ai_history, clear_ai_history, save_note, get_notes, delete_note, save_preference, get_preference,
            list_workspace_files, create_workspace_item, read_workspace_file, save_workspace_file, delete_workspace_item, rename_workspace_item, get_workspace_templates,
            open_terminal, opencode, watch_workspace,
            agent_grep, agent_list_files, execute_agent_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

