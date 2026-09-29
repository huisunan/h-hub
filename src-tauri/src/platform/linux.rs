use crate::model::AppEntry;
use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

pub fn platform_name() -> &'static str {
    "linux"
}

pub fn default_shortcut() -> &'static str {
    "Alt+Space"
}

pub fn modifier() -> &'static str {
    "Alt"
}

fn application_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/usr/share/applications"),
        PathBuf::from("/usr/local/share/applications"),
        PathBuf::from("/var/lib/flatpak/exports/share/applications"),
    ];
    if let Some(data) = dirs::data_dir() {
        dirs.push(data.join("applications"));
        dirs.push(data.join("flatpak/exports/share/applications"));
    }
    dirs
}

pub fn scan_apps() -> Vec<AppEntry> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for dir in application_dirs() {
        if !dir.exists() {
            continue;
        }
        for entry in WalkDir::new(&dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("desktop") {
                continue;
            }
            if let Some(app) = parse_desktop(path) {
                if seen.insert(app.id.clone()) {
                    out.push(app);
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

fn parse_desktop(path: &Path) -> Option<AppEntry> {
    let text = std::fs::read_to_string(path).ok()?;
    let mut name = None;
    let mut exec = None;
    let mut icon = None;
    let mut no_display = false;
    let mut entry_type = None;
    let mut in_entry = false;

    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_entry {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key {
            "Name" => name = Some(value.trim().to_string()),
            "Exec" => exec = Some(value.trim().to_string()),
            "Icon" => icon = Some(value.trim().to_string()),
            "NoDisplay" => no_display = value.trim().eq_ignore_ascii_case("true"),
            "Type" => entry_type = Some(value.trim().to_string()),
            _ => {}
        }
    }

    if no_display {
        return None;
    }
    if let Some(t) = entry_type {
        if t != "Application" {
            return None;
        }
    }
    let name = name?;
    let exec = exec?;

    let argv: Vec<String> = exec
        .split_whitespace()
        .filter(|token| !token.starts_with('%'))
        .map(|token| token.to_string())
        .collect();
    if argv.is_empty() {
        return None;
    }

    let target = path.to_string_lossy().to_string();
    Some(AppEntry {
        id: format!("linux:{}", target),
        name,
        target,
        icon: icon.as_deref().and_then(resolve_icon),
        source: "desktop".into(),
        args: argv,
    })
}

fn resolve_icon(name: &str) -> Option<String> {
    if name.is_empty() {
        return None;
    }
    let direct = Path::new(name);
    if direct.is_absolute() {
        return crate::platform::image_file_data_url(name);
    }

    let sizes = ["256x256", "128x128", "64x64", "48x48", "scalable"];
    let bases = [
        "/usr/share/icons/hicolor",
        "/usr/share/icons/Adwaita",
        "/usr/share/icons/gnome",
    ];
    for base in bases {
        for size in sizes {
            for ext in ["png", "svg"] {
                let candidate = format!("{base}/{size}/apps/{name}.{ext}");
                if Path::new(&candidate).exists() {
                    if let Some(data) = crate::platform::image_file_data_url(&candidate) {
                        return Some(data);
                    }
                }
            }
        }
    }
    for candidate in [
        format!("/usr/share/pixmaps/{name}.png"),
        format!("/usr/share/pixmaps/{name}.svg"),
        format!("/usr/share/pixmaps/{name}.xpm"),
    ] {
        if Path::new(&candidate).exists() {
            if let Some(data) = crate::platform::image_file_data_url(&candidate) {
                return Some(data);
            }
        }
    }
    None
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
    if kind == "app" && !args.is_empty() {
        let mut cmd = Command::new(&args[0]);
        cmd.args(&args[1..]);
        return cmd.spawn().map(|_| ()).map_err(|e| e.to_string());
    }
    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn icon_data_url(path: &str) -> Option<String> {
    if path.ends_with(".desktop") {
        if let Some(app) = parse_desktop(Path::new(path)) {
            return app.icon;
        }
    }
    crate::platform::image_file_data_url(path)
}

/// Capture the primary display to a PNG file and return its path.
pub fn capture_primary_display_to_file() -> Result<String, String> {
    let temp = std::env::temp_dir().join(format!(
        "hhub-capture-{}-{}.png",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    let path = temp.to_string_lossy().to_string();

    let attempts: Vec<(&str, Vec<String>)> = vec![
        ("grim", vec![path.clone()]),
        ("gnome-screenshot", vec!["-f".into(), path.clone()]),
        (
            "import",
            vec!["-window".into(), "root".into(), path.clone()],
        ),
        (
            "spectacle",
            vec!["-b".into(), "-n".into(), "-o".into(), path.clone()],
        ),
    ];

    let mut last_error =
        String::from("未找到可用的截图工具（grim / gnome-screenshot / import / spectacle）");
    for (program, args) in attempts {
        let _ = std::fs::remove_file(&temp);
        match Command::new(program).args(&args).status() {
            Ok(status) if status.success() && temp.exists() => return Ok(path),
            Ok(status) => {
                last_error = format!("{program} 退出码：{status}");
            }
            Err(error) => {
                last_error = format!("{program}：{error}");
            }
        }
    }

    let _ = std::fs::remove_file(&temp);
    Err(last_error)
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
        "lock" => spawn("loginctl", &["lock-session"]),
        "backDesktop" => spawn("xdotool", &["key", "super+d"]),
        "screenshot" => spawn("gnome-screenshot", &["-a"]),
        _ => Err(format!("unknown action: {id}")),
    }
}
