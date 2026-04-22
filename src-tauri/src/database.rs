use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use serde::{Serialize, Deserialize};

#[allow(dead_code)]
const DB_VERSION: i32 = 1;

#[derive(Debug, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub file_path: String,
    pub cover_image: Option<Vec<u8>>, // Base64 sent to frontend
    pub format: String,
    pub page_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Highlight {
    pub id: String,
    pub book_id: String,
    pub content: String,
    pub annotation: Option<String>,
    pub location: String, // CFI or similar location identifier
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIConversation {
    pub id: i64,
    pub book_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIMessage {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String,
    pub selected_text: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub book_id: Option<String>,
    pub content: String,
    pub location: Option<String>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct UserPreference {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceFile {
    pub id: Option<i64>,
    pub path: String,
    pub file_type: String,
    pub last_cursor_position: Option<i32>,
    pub last_scroll_position: Option<i32>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTemplate {
    pub id: Option<i64>,
    pub name: String,
    pub file_type: String,
    pub template_content: String,
    pub is_builtin: bool,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct BookWorkspaceLink {
    pub id: Option<i64>,
    pub book_id: String,
    pub workspace_file_path: String,
}

pub struct Database {
    pub path: PathBuf,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
        std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
        let path = app_dir.join("library.db");
        
        let db = Database { path };
        db.init().expect("failed to initialize database");
        db
    }

    fn open(&self) -> Result<Connection> {
        Connection::open(&self.path)
    }

    pub fn init(&self) -> Result<()> {
        let conn = self.open()?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                file_path TEXT NOT NULL UNIQUE,
                cover_image BLOB,
                format TEXT NOT NULL,
                page_count INTEGER,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_read_at DATETIME
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS highlights (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                content TEXT NOT NULL,
                annotation TEXT,
                location TEXT NOT NULL, 
                color TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS reading_progress (
                book_id TEXT PRIMARY KEY,
                current_page INTEGER, 
                current_location TEXT,
                percentage REAL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS ai_conversations (
                id INTEGER PRIMARY KEY,
                book_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS ai_messages (
                id INTEGER PRIMARY KEY,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL, 
                content TEXT NOT NULL,
                selected_text TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                book_id TEXT,
                content TEXT NOT NULL,
                location TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Migration: Add location column to notes if it doesn't exist
        let _ = conn.execute("ALTER TABLE notes ADD COLUMN location TEXT", []);

        conn.execute(
            "CREATE TABLE IF NOT EXISTS user_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS workspace_files (
                id INTEGER PRIMARY KEY,
                path TEXT UNIQUE NOT NULL,
                file_type TEXT,
                last_cursor_position INTEGER,
                last_scroll_position INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS file_templates (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                template_content TEXT NOT NULL,
                is_builtin BOOLEAN DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_workspace_links (
                id INTEGER PRIMARY KEY,
                book_id TEXT NOT NULL,
                workspace_file_path TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;
        
        Ok(())
    }

    pub fn insert_book(&self, book: &Book) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO books (id, title, author, file_path, cover_image, format, page_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(file_path) DO NOTHING",
            params![
                book.id,
                book.title,
                book.author,
                book.file_path,
                book.cover_image,
                book.format,
                book.page_count
            ],
        )?;
        Ok(())
    }

    pub fn get_all_books(&self) -> Result<Vec<Book>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, title, author, file_path, cover_image, format, page_count FROM books ORDER BY added_at DESC")?;
        
        let book_iter = stmt.query_map([], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                file_path: row.get(3)?,
                cover_image: row.get(4)?,
                format: row.get(5)?,
                page_count: row.get(6)?,
            })
        })?;

        let mut books = Vec::new();
        for book in book_iter {
            books.push(book?);
        }
        Ok(books)
    }
    
    pub fn exists_by_path(&self, path: &str) -> Result<bool> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT 1 FROM books WHERE file_path = ?1")?;
        Ok(stmt.exists(params![path])?)
    }

    pub fn delete_book_by_id(&self, id: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute("DELETE FROM books WHERE id = ?1", params![id])?;
        // Cascading deletes handled by foreign keys for highlights/progress
        Ok(())
    }

    pub fn add_highlight(&self, highlight: &Highlight) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO highlights (id, book_id, content, annotation, location, color)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                highlight.id,
                highlight.book_id,
                highlight.content,
                highlight.annotation,
                highlight.location,
                highlight.color
            ],
        )?;
        Ok(())
    }

    pub fn get_highlights(&self, book_id: &str) -> Result<Vec<Highlight>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, book_id, content, annotation, location, color FROM highlights WHERE book_id = ?1 ORDER BY created_at DESC")?;
        
        let highlight_iter = stmt.query_map(params![book_id], |row| {
            Ok(Highlight {
                id: row.get(0)?,
                book_id: row.get(1)?,
                content: row.get(2)?,
                annotation: row.get(3)?,
                location: row.get(4)?,
                color: row.get(5)?,
            })
        })?;

        let mut highlights = Vec::new();
        for h in highlight_iter {
            highlights.push(h?);
        }
        Ok(highlights)
    }

    pub fn delete_highlight(&self, id: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute("DELETE FROM highlights WHERE id = ?1", params![id])?;
        Ok(())
    }

    // AI Conversations
    pub fn create_conversation(&self, book_id: &str) -> Result<i64> {
        let conn = self.open()?;
        
        // Ensure "system" book exists for general agent chat to satisfy foreign key
        if book_id == "system" {
            conn.execute(
                "INSERT OR IGNORE INTO books (id, title, author, file_path, format) 
                 VALUES ('system', 'System Agent Chat', 'AI', 'internal://system_chat', 'internal')",
                 []
            )?;
        }

        conn.execute(
            "INSERT INTO ai_conversations (book_id) VALUES (?1)",
            params![book_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_conversations(&self, book_id: &str) -> Result<Vec<AIConversation>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, book_id, created_at, updated_at FROM ai_conversations WHERE book_id = ?1 ORDER BY updated_at DESC")?;
        
        let iter = stmt.query_map(params![book_id], |row| {
            Ok(AIConversation {
                id: row.get(0)?,
                book_id: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item?);
        }
        Ok(result)
    }

    pub fn add_ai_message(&self, msg: &AIMessage) -> Result<i64> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO ai_messages (conversation_id, role, content, selected_text) VALUES (?1, ?2, ?3, ?4)",
            params![msg.conversation_id, msg.role, msg.content, msg.selected_text],
        )?;
        // Update conversation timestamp
        conn.execute("UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1", params![msg.conversation_id])?;
        
        Ok(conn.last_insert_rowid())
    }

    pub fn get_ai_messages(&self, conversation_id: i64) -> Result<Vec<AIMessage>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, conversation_id, role, content, selected_text, timestamp FROM ai_messages WHERE conversation_id = ?1 ORDER BY timestamp ASC")?;
        
        let iter = stmt.query_map(params![conversation_id], |row| {
            Ok(AIMessage {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                selected_text: row.get(4)?,
                timestamp: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item?);
        }
        Ok(result)
    }

    pub fn clear_conversation(&self, conversation_id: i64) -> Result<()> {
        let conn = self.open()?;
        conn.execute("DELETE FROM ai_messages WHERE conversation_id = ?1", params![conversation_id])?;
        Ok(())
    }

    // Notes
    pub fn add_note(&self, note: &Note) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO notes (id, book_id, content, location) VALUES (?1, ?2, ?3, ?4)",
            params![note.id, note.book_id, note.content, note.location],
        )?;
        Ok(())
    }

    pub fn get_notes(&self, book_id: &str) -> Result<Vec<Note>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, book_id, content, location, created_at FROM notes WHERE book_id = ?1 ORDER BY created_at DESC")?;
        
        let iter = stmt.query_map(params![book_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                book_id: row.get(1)?,
                content: row.get(2)?,
                location: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item?);
        }
        Ok(result)
    }

    pub fn delete_note(&self, id: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Preferences
    pub fn save_preference(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_preference(&self, key: &str) -> Result<Option<String>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT value FROM user_preferences WHERE key = ?1")?;
        
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    // Workspace Metadata
    pub fn save_workspace_file_metadata(&self, file: &WorkspaceFile) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT OR REPLACE INTO workspace_files (path, file_type, last_cursor_position, last_scroll_position, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)",
            params![file.path, file.file_type, file.last_cursor_position, file.last_scroll_position],
        )?;
        Ok(())
    }

    pub fn get_workspace_file_metadata(&self, path: &str) -> Result<Option<WorkspaceFile>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, path, file_type, last_cursor_position, last_scroll_position, updated_at FROM workspace_files WHERE path = ?1")?;
        let mut rows = stmt.query(params![path])?;
        if let Some(row) = rows.next()? {
            Ok(Some(WorkspaceFile {
                id: Some(row.get(0)?),
                path: row.get(1)?,
                file_type: row.get(2)?,
                last_cursor_position: row.get(3)?,
                last_scroll_position: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete_workspace_file_metadata(&self, path: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute("DELETE FROM workspace_files WHERE path = ?1", params![path])?;
        Ok(())
    }

    // Templates
    pub fn get_templates(&self) -> Result<Vec<FileTemplate>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT id, name, file_type, template_content, is_builtin FROM file_templates")?;
        let iter = stmt.query_map([], |row| {
            Ok(FileTemplate {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                file_type: row.get(2)?,
                template_content: row.get(3)?,
                is_builtin: row.get(4)?,
            })
        })?;
        let mut templates = Vec::new();
        for t in iter {
            templates.push(t?);
        }
        Ok(templates)
    }

    // Book links
    #[allow(dead_code)]
    pub fn link_book_to_workspace_file(&self, book_id: &str, file_path: &str) -> Result<()> {
        let conn = self.open()?;
        conn.execute(
            "INSERT OR REPLACE INTO book_workspace_links (book_id, workspace_file_path) VALUES (?1, ?2)",
            params![book_id, file_path],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_book_workspace_links(&self, book_id: &str) -> Result<Vec<String>> {
        let conn = self.open()?;
        let mut stmt = conn.prepare("SELECT workspace_file_path FROM book_workspace_links WHERE book_id = ?1")?;
        let iter = stmt.query_map(params![book_id], |row| row.get(0))?;
        let mut links = Vec::new();
        for l in iter {
            links.push(l?);
        }
        Ok(links)
    }
}

