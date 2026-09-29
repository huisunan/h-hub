use crate::model::AppEntry;
use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

pub fn platform_name() -> &'static str {
    "macos"
}

pub fn default_shortcut() -> &'static str {
    "Alt+Space"
}

pub fn modifier() -> &'static str {
    "Control"
}

pub fn scan_apps() -> Vec<AppEntry> {
    let mut roots: Vec<PathBuf> = vec![
        PathBuf::from("/Applications"),
        PathBuf::from("/System/Applications"),
        PathBuf::from("/Applications/Utilities"),
        PathBuf::from("/System/Applications/Utilities"),
    ];
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Applications"));
    }

    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for root in roots {
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(&root)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if path.extension().and_then(|s| s.to_str()) != Some("app") {
                continue;
            }
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }
            let target = path.to_string_lossy().to_string();
            if !seen.insert(target.clone()) {
                continue;
            }
            out.push(AppEntry {
                id: format!("mac:{}", target),
                name,
                target,
                icon: None,
                source: "applications".into(),
                args: Vec::new(),
            });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

pub fn launch(kind: &str, target: &str, args: &[String]) -> Result<(), String> {
    if kind == "shell" {
        return Command::new("sh")
            .arg("-c")
            .arg(target)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string());
    }
    Command::new("open")
        .arg(target)
        .arg("--args")
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn icon_data_url(path: &str) -> Option<String> {
    let p = Path::new(path);
    if p.extension().and_then(|s| s.to_str()) == Some("app") {
        if let Some(icon) = app_icon(p) {
            return Some(icon);
        }
    }
    crate::platform::image_file_data_url(path)
}

fn app_icon(app: &Path) -> Option<String> {
    let resources = app.join("Contents/Resources");
    if !resources.exists() {
        return None;
    }
    let icns = WalkDir::new(&resources)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.into_path())
        .find(|p| p.extension().and_then(|s| s.to_str()) == Some("icns"))?;

    let out = std::env::temp_dir().join(format!(
        "hhub-icon-{}-{}.png",
        std::process::id(),
        icns.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("icon")
            .replace(' ', "_")
    ));
    let status = Command::new("sips")
        .args(["-s", "format", "png"])
        .arg(&icns)
        .arg("--out")
        .arg(&out)
        .output()
        .ok()?;
    if !status.status.success() {
        let _ = std::fs::remove_file(&out);
        return None;
    }
    let result = crate::platform::image_file_data_url(&out.to_string_lossy());
    let _ = std::fs::remove_file(&out);
    result
}

/// Capture the primary display straight to a PNG file and return its path.
/// Requires the Screen Recording permission; `screencapture` fails or returns a
/// blank frame when it has not been granted.
pub fn capture_primary_display_to_file() -> Result<String, String> {
    let temp = std::env::temp_dir().join(format!(
        "hhub-capture-{}-{}.png",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));

    let output = Command::new("screencapture")
        .args(["-x", "-m", "-t", "png"])
        .arg(&temp)
        .output()
        .map_err(|error| format!("无法运行 screencapture：{error}"))?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&temp);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let hint = "请到「系统设置 → 隐私与安全性 → 屏幕录制」授权后重试";
        return Err(if stderr.is_empty() {
            format!("截图失败，{hint}")
        } else {
            format!("{stderr}（{hint}）")
        });
    }

    Ok(temp.to_string_lossy().to_string())
}

pub fn run_action(id: &str) -> Result<(), String> {
    let spawn = |program: &str, args: &[&str]| -> Result<(), String> {
        Command::new(program)
            .args(args)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    };
    match id {
        "lock" => spawn(
            "osascript",
            &[
                "-e",
                "tell application \"System Events\" to keystroke \"q\" using {control down, command down}",
            ],
        ),
        "backDesktop" => spawn(
            "osascript",
            &["-e", "tell application \"System Events\" to key code 103"],
        ),
        "screenshot" => spawn("screencapture", &["-i"]),
        _ => Err(format!("unknown action: {id}")),
    }
}
