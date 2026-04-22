use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenRouterMessage {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<OpenRouterMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessage,
}

#[derive(Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}


pub async fn call_ai_api(
    api_key: String,
    model: String,
    messages: Vec<OpenRouterMessage>,
    selected_text: Option<String>,
) -> Result<String, String> {
    let client = Client::new();
    let url = "https://openrouter.ai/api/v1/chat/completions";

    let mut api_messages = messages;

    // Inject system context if selected text is present
    if let Some(text) = selected_text {
        let system_msg = format!(
            "The user is asking about the following text selection from a book:\n\n\"{}\"\n\nPlease provide helpful, context-aware assistance.",
            text
        );
        api_messages.insert(0, OpenRouterMessage {
            role: "system".to_string(),
            content: serde_json::Value::String(system_msg),
        });
    }

    let body = OpenRouterRequest {
        model: model.clone(),
        messages: api_messages,
        temperature: 0.7,
        max_tokens: None,
    };

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "http://localhost:1420") // Required by OpenRouter
        .header("X-Title", "VinylReader") // Optional
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API Error ({}): {}", status, error_text));
    }

    let result: OpenRouterResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    result
        .choices
        .first()
        .and_then(|c| c.message.content.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "No response content".to_string())
}
