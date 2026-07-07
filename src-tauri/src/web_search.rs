use serde::Deserialize;
use crate::types::SearchResult;

#[derive(Deserialize)]
struct TavilyResponse {
    #[serde(default)]
    results: Vec<TavilyResult>,
}

#[derive(Deserialize)]
struct TavilyResult {
    title: String,
    url: String,
    content: String,
    #[serde(default)]
    score: f64,
}

pub async fn search_web(query: &str, api_key: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.tavily.com/search")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "query": query,
            "search_depth": "basic",
            "max_results": 6,
        }))
        .send()
        .await
        .map_err(|error| format!("Tavily request failed: {error}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Tavily returned {status}: {body}"));
    }

    let tavily: TavilyResponse = resp
        .json()
        .await
        .map_err(|error| format!("Tavily parse failed: {error}"))?;

    let results: Vec<SearchResult> = tavily
        .results
        .into_iter()
        .map(|r| SearchResult {
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score,
        })
        .collect();

    Ok(results)
}
