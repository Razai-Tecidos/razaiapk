#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  fs,
  path::PathBuf,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

fn get_cache_buster() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs()
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .setup(|app| {
      // Windows/WebView2: purge stale embedded caches to ensure fresh frontend
      #[cfg(target_os = "windows")]
      {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
          let mut p = PathBuf::from(local_app_data);
          // cache dir is based on the identifier in tauri.conf.json
          p.push("com.razai.tools");
          p.push("EBWebView");
          if p.exists() {
            match fs::remove_dir_all(&p) {
              Ok(_) => eprintln!("[Tauri] Cleared WebView2 cache at {:?}", &p),
              Err(e) => eprintln!("[Tauri] Failed to clear WebView2 cache at {:?}: {}", &p, e),
            }
          } else {
            eprintln!("[Tauri] WebView2 cache dir not found: {:?}", &p);
          }
        }
      }

      // Get the main window and set cache-busting URL parameter
      if let Some(window) = app.get_webview_window("main") {
        let cache_buster = get_cache_buster();
        // Force reload with unique query parameter
        let _result = window.eval(&format!(
          "window.__RAZAI_CACHE_BUSTER__ = '{}'",
          cache_buster
        ));
        eprintln!("[Tauri] Cache buster set: {}", cache_buster);
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
