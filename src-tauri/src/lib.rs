use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const DEFAULT_TRASH_RETENTION_DAYS: u32 = 3;
const INDEX_FILE_NAME: &str = "folders.json";

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
  custom_data_dir: Option<String>,
  trash_retention_days: Option<u32>,
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map(|dir| dir.join("settings.json"))
    .map_err(|e| e.to_string())
}

fn load_settings(app: &tauri::AppHandle) -> AppSettings {
  settings_path(app)
    .ok()
    .and_then(|path| fs::read_to_string(path).ok())
    .and_then(|content| serde_json::from_str(&content).ok())
    .unwrap_or_default()
}

fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
  let path = settings_path(app)?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let content =
    serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
  fs::write(path, content).map_err(|e| e.to_string())
}

fn now_millis() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

fn trash_retention_days(app: &tauri::AppHandle) -> u32 {
  load_settings(app)
    .trash_retention_days
    .unwrap_or(DEFAULT_TRASH_RETENTION_DAYS)
    .max(1)
}

fn default_files_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map(|dir| dir.join("files"))
    .map_err(|e| e.to_string())
}

fn files_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = match load_settings(app).custom_data_dir {
    Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
    _ => default_files_dir(app)?,
  };
  if !dir.exists() {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(dir)
}

fn trash_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = files_dir(app)?.join(".trash");
  if !dir.exists() {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(dir)
}

/// 校验相对路径（文件或文件夹）：`a/b` 形式，禁止绝对路径、`..`、隐藏段与反斜杠
fn sanitize_rel_path(rel: &str) -> Result<String, String> {
  let rel = rel.trim().trim_matches('/');
  if rel.is_empty() {
    return Err("invalid path".to_string());
  }
  for seg in rel.split('/') {
    if seg.is_empty() || seg == ".." || seg.starts_with('.') || seg.contains('\\') {
      return Err("invalid path".to_string());
    }
  }
  Ok(rel.to_string())
}

/// 空路径表示根目录
fn sanitize_dir_path(dir: Option<String>) -> Result<String, String> {
  match dir {
    Some(dir) if !dir.trim().is_empty() => sanitize_rel_path(&dir),
    _ => Ok(String::new()),
  }
}

fn entry_path(app: &tauri::AppHandle, rel: &str) -> Result<PathBuf, String> {
  Ok(files_dir(app)?.join(rel))
}

/// 文件路径：相对路径自动追加 .drawnix 扩展名（前端传入的 path 不含扩展名）
fn file_path(app: &tauri::AppHandle, rel: &str) -> Result<PathBuf, String> {
  Ok(files_dir(app)?.join(format!("{}.drawnix", rel)))
}

fn last_seg(rel: &str) -> &str {
  rel.rsplit('/').next().unwrap_or(rel)
}

fn parent_of(rel: &str) -> Option<&str> {
  let idx = rel.rfind('/')?;
  Some(&rel[..idx])
}

// ---------------------------------------------------------------------------
// 显示顺序索引（folders.json）：目录相对路径 -> 该目录下条目顺序
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct DirOrder {
  #[serde(default)]
  dirs: Vec<String>,
  #[serde(default)]
  files: Vec<String>,
}

type OrderMap = HashMap<String, DirOrder>;

fn index_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  Ok(files_dir(app)?.join(INDEX_FILE_NAME))
}

fn load_order(app: &tauri::AppHandle) -> OrderMap {
  let mut order = index_path(app)
    .ok()
    .and_then(|path| fs::read_to_string(path).ok())
    .and_then(|content| serde_json::from_str::<OrderMap>(&content).ok())
    .unwrap_or_default();
  // 自愈：清理历史版本可能写入的重复条目
  for entry in order.values_mut() {
    dedup_strings(&mut entry.dirs);
    dedup_strings(&mut entry.files);
  }
  order
}

fn dedup_strings(values: &mut Vec<String>) {
  let mut seen = std::collections::HashSet::new();
  values.retain(|value| seen.insert(value.clone()));
}

fn save_order(app: &tauri::AppHandle, order: &OrderMap) -> Result<(), String> {
  let path = index_path(app)?;
  let content = serde_json::to_string_pretty(order).map_err(|e| e.to_string())?;
  fs::write(path, content).map_err(|e| e.to_string())
}

fn dir_key(rel: &str) -> String {
  parent_of(rel).unwrap_or("").to_string()
}

/// 重命名/移动文件夹后迁移索引键与其父目录中的条目名
fn order_migrate_dir_prefix(
  order: &mut OrderMap,
  old_path: &str,
  new_path: &str,
) {
  let old_prefix = format!("{}/", old_path);
  let mut migrated: HashMap<String, DirOrder> = HashMap::new();
  for (key, value) in order.iter() {
    let new_key = if key == old_path {
      new_path.to_string()
    } else if let Some(rest) = key.strip_prefix(&old_prefix) {
      format!("{}/{}", new_path, rest)
    } else {
      key.clone()
    };
    migrated.insert(new_key, value.clone());
  }
  *order = migrated;
  // 父目录的子文件夹列表中改名
  let (old_parent, new_parent) = (dir_key(old_path), dir_key(new_path));
  let old_name = last_seg(old_path).to_string();
  let new_name = last_seg(new_path).to_string();
  if old_parent == new_parent {
    if let Some(entry) = order.get_mut(&old_parent) {
      for name in entry.dirs.iter_mut() {
        if *name == old_name {
          *name = new_name.clone();
        }
      }
    }
  } else {
    if let Some(entry) = order.get_mut(&old_parent) {
      entry.dirs.retain(|name| *name != old_name);
    }
    order
      .entry(new_parent)
      .or_default()
      .dirs
      .push(new_name);
  }
}

// ---------------------------------------------------------------------------
// 目录树
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TreeDirEntry {
  path: String,
  created_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TreeFileEntry {
  path: String,
  created_at: u64,
  modified_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TreeResult {
  dirs: Vec<TreeDirEntry>,
  files: Vec<TreeFileEntry>,
  order: OrderMap,
}

fn collect_tree(
  dir: &Path,
  rel: &str,
  dirs: &mut Vec<TreeDirEntry>,
  files: &mut Vec<TreeFileEntry>,
) {
  let Ok(entries) = fs::read_dir(dir) else {
    return;
  };
  for entry in entries.flatten() {
    let path = entry.path();
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    if name == INDEX_FILE_NAME || name.starts_with('.') {
      continue;
    }
    let child_rel = if rel.is_empty() {
      name.clone()
    } else {
      format!("{}/{}", rel, name)
    };
    let metadata = entry.metadata().ok();
    let modified_at = metadata
      .as_ref()
      .and_then(|meta| meta.modified().ok())
      .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
      .map(|duration| duration.as_millis() as u64)
      .unwrap_or(0);
    let created_at = metadata
      .as_ref()
      .and_then(|meta| meta.created().ok())
      .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
      .map(|duration| duration.as_millis() as u64)
      .unwrap_or(modified_at);
    if path.is_dir() {
      dirs.push(TreeDirEntry {
        path: child_rel.clone(),
        created_at,
      });
      collect_tree(&path, &child_rel, dirs, files);
    } else if path.extension().map(|e| e == "drawnix").unwrap_or(false) {
      files.push(TreeFileEntry {
        path: child_rel.trim_end_matches(".drawnix").to_string(),
        created_at,
        modified_at,
      });
    }
  }
}

#[tauri::command]
fn list_tree(app: tauri::AppHandle) -> Result<TreeResult, String> {
  let root = files_dir(&app)?;
  let mut dirs = Vec::new();
  let mut files = Vec::new();
  collect_tree(&root, "", &mut dirs, &mut files);
  let order = load_order(&app);
  Ok(TreeResult {
    dirs,
    files,
    order,
  })
}

// ---------------------------------------------------------------------------
// 文件读写
// ---------------------------------------------------------------------------

#[tauri::command]
fn read_drawnix_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
  let path = sanitize_rel_path(&path)?;
  fs::read_to_string(file_path(&app, &path)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_drawnix_file(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let target = file_path(&app, &path)?;
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(target, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_drawnix_file(app: tauri::AppHandle, path: String, new_name: String) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let new_name = new_name.trim().trim_matches('/');
  if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') || new_name.starts_with('.') {
    return Err("invalid file name".to_string());
  }
  let old_target = file_path(&app, &path)?;
  if !old_target.exists() {
    return Err("file not found".to_string());
  }
  let new_path = match parent_of(&path) {
    Some(parent) => format!("{}/{}", parent, new_name),
    None => new_name.to_string(),
  };
  let new_target = file_path(&app, &new_path)?;
  if new_target.exists() {
    return Err("target file already exists".to_string());
  }
  fs::rename(old_target, new_target).map_err(|e| e.to_string())?;
  // 更新索引中该目录的文件顺序
  let mut order = load_order(&app);
  let old_name = last_seg(&path);
  if let Some(entry) = order.get_mut(&dir_key(&path)) {
    for name in entry.files.iter_mut() {
      if *name == old_name {
        *name = new_name.to_string();
      }
    }
  }
  save_order(&app, &order)
}

// ---------------------------------------------------------------------------
// 回收站：文件名 `{stamp}_{路径平坦化}.drawnix` + 同名 `.json` 元数据记录原路径
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct TrashMeta {
  path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DrawnixTrashEntry {
  trash_file: String,
  path: String,
  deleted_at: u64,
}

fn parse_trash_deleted_at(path: &Path) -> Option<u64> {
  let file_name = path.file_name()?.to_string_lossy();
  let stem = file_name.strip_suffix(".drawnix")?;
  let (stamp, _) = stem.split_once('_')?;
  stamp.parse::<u64>().ok()
}

fn move_to_trash(app: &tauri::AppHandle, rel: &str) -> Result<(), String> {
  let source = file_path(app, rel)?;
  if !source.exists() {
    return Err("file not found".to_string());
  }
  let trash_file = trash_dir(app)?.join(format!("{}_{}.drawnix", now_millis(), rel.replace('/', "__")));
  fs::rename(&source, &trash_file).map_err(|e| e.to_string())?;
  let meta = TrashMeta {
    path: rel.to_string(),
  };
  let meta_path = PathBuf::from(format!("{}.json", trash_file.to_string_lossy()));
  fs::write(meta_path, serde_json::to_string(&meta).map_err(|e| e.to_string())?)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_drawnix_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  move_to_trash(&app, &path)?;
  cleanup_expired_trash(&app);
  Ok(())
}

#[tauri::command]
fn list_trash_files(app: tauri::AppHandle) -> Result<Vec<DrawnixTrashEntry>, String> {
  cleanup_expired_trash(&app);
  let dir = trash_dir(&app)?;
  let mut files = Vec::new();
  for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let path = entry.map_err(|e| e.to_string())?.path();
    if !path.is_file() {
      continue;
    }
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    if !file_name.ends_with(".drawnix") {
      continue;
    }
    let Some(deleted_at) = parse_trash_deleted_at(&path) else {
      continue;
    };
    // 优先读取元数据中的原始路径；旧格式回退到文件名解码
    // 注意：回收站元数据文件名是 `xxx.drawnix.json`，不能使用 with_extension（会替换掉 .drawnix）
    let rel_path = fs::read_to_string(format!("{}.json", path.to_string_lossy()))
      .ok()
      .and_then(|content| serde_json::from_str::<TrashMeta>(&content).ok())
      .map(|meta| meta.path)
      .unwrap_or_else(|| {
        file_name
          .trim_end_matches(".drawnix")
          .split_once('_')
          .map(|(_, name)| name.replace("__", "/"))
          .unwrap_or(file_name.clone())
      });
    files.push(DrawnixTrashEntry {
      trash_file: file_name,
      path: rel_path,
      deleted_at,
    });
  }
  files.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
  Ok(files)
}

#[tauri::command]
fn restore_drawnix_file(app: tauri::AppHandle, trash_file: String) -> Result<(), String> {
  let trash_file = sanitize_rel_path(&trash_file.replace('/', "_"))?;
  let trash_path = trash_dir(&app)?.join(&trash_file);
  if !trash_path.exists() {
    return Err("trash entry not found".to_string());
  }
  let meta_path = PathBuf::from(format!("{}.json", trash_path.to_string_lossy()));
  let rel = fs::read_to_string(&meta_path)
    .ok()
    .and_then(|content| serde_json::from_str::<TrashMeta>(&content).ok())
    .map(|meta| meta.path)
    .unwrap_or_else(|| {
      trash_file
        .trim_end_matches(".drawnix")
        .split_once('_')
        .map(|(_, name)| name.replace("__", "/"))
        .unwrap_or_else(|| trash_file.clone())
    });
  let target = file_path(&app, &rel)?;
  if target.exists() {
    return Err("target file already exists".to_string());
  }
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::rename(&trash_path, &target).map_err(|e| e.to_string())?;
  let _ = fs::remove_file(&meta_path);
  Ok(())
}

fn cleanup_expired_trash(app: &tauri::AppHandle) {
  let Ok(dir) = trash_dir(app) else {
    return;
  };
  let retention_ms = (trash_retention_days(app) as u64) * 24 * 60 * 60 * 1000;
  let now = now_millis();
  let Ok(entries) = fs::read_dir(&dir) else {
    return;
  };
  for entry in entries.flatten() {
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    if let Some(deleted_at) = parse_trash_deleted_at(&path) {
      if now.saturating_sub(deleted_at) > retention_ms {
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(format!("{}.json", path.to_string_lossy()));
      }
    } else if file_name.ends_with(".json") {
      // 孤立元数据一并清理
      if let Some(base) = file_name.strip_suffix(".json") {
        if !dir.join(base).exists() {
          let _ = fs::remove_file(&path);
        }
      }
    }
  }
}

#[tauri::command]
fn empty_trash(app: tauri::AppHandle) -> Result<u64, String> {
  let dir = trash_dir(&app)?;
  let mut removed = 0u64;
  for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let path = entry.map_err(|e| e.to_string())?.path();
    if path.is_file() {
      fs::remove_file(&path).map_err(|e| e.to_string())?;
      removed += 1;
    }
  }
  Ok(removed)
}

// ---------------------------------------------------------------------------
// 分组（物理子文件夹）
// ---------------------------------------------------------------------------

#[tauri::command]
fn create_folder(app: tauri::AppHandle, parent: Option<String>, name: String) -> Result<(), String> {
  let name = name.trim().trim_matches('/');
  if name.is_empty() || name.contains('/') || name.contains('\\') || name.starts_with('.') {
    return Err("invalid folder name".to_string());
  }
  let parent = sanitize_dir_path(parent)?;
  let rel = if parent.is_empty() {
    name.to_string()
  } else {
    format!("{}/{}", parent, name)
  };
  let target = entry_path(&app, &rel)?;
  if target.exists() {
    return Err("folder already exists".to_string());
  }
  fs::create_dir_all(&target).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_folder(app: tauri::AppHandle, path: String, new_name: String) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let new_name = new_name.trim().trim_matches('/');
  if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') || new_name.starts_with('.') {
    return Err("invalid folder name".to_string());
  }
  let new_path = match parent_of(&path) {
    Some(parent) => format!("{}/{}", parent, new_name),
    None => new_name.to_string(),
  };
  let source = entry_path(&app, &path)?;
  if !source.is_dir() {
    return Err("folder not found".to_string());
  }
  let target = entry_path(&app, &new_path)?;
  if target.exists() {
    return Err("target folder already exists".to_string());
  }
  fs::rename(source, target).map_err(|e| e.to_string())?;
  let mut order = load_order(&app);
  order_migrate_dir_prefix(&mut order, &path, &new_path);
  save_order(&app, &order)
}

/// 删除分组：内部所有 .drawnix 文件移入回收站，然后删除整个目录
#[tauri::command]
fn delete_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let target = entry_path(&app, &path)?;
  if !target.is_dir() {
    return Err("folder not found".to_string());
  }
  let mut files = Vec::new();
  let mut dirs = Vec::new();
  collect_tree(&target, &path, &mut dirs, &mut files);
  for file in files {
    move_to_trash(&app, &file.path)?;
  }
  fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
  // 索引：父目录子文件夹列表移除该分组，并清理其键
  let mut order = load_order(&app);
  let old_name = last_seg(&path).to_string();
  if let Some(entry) = order.get_mut(&dir_key(&path)) {
    entry.dirs.retain(|name| *name != old_name);
  }
  let prefix = format!("{}/", path);
  order.retain(|key, _| key != &path && !key.starts_with(&prefix));
  save_order(&app, &order)
}

#[tauri::command]
fn move_file_to_dir(
  app: tauri::AppHandle,
  path: String,
  target_dir: Option<String>,
) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let target_dir = sanitize_dir_path(target_dir)?;
  let name = last_seg(&path).to_string();
  let new_rel = if target_dir.is_empty() {
    name.clone()
  } else {
    format!("{}/{}", target_dir, name)
  };
  if new_rel == path {
    return Ok(());
  }
  let source = file_path(&app, &path)?;
  if !source.exists() {
    return Err("file not found".to_string());
  }
  let target = file_path(&app, &new_rel)?;
  if target.exists() {
    return Err("target file already exists".to_string());
  }
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::rename(source, target).map_err(|e| e.to_string())?;
  let mut order = load_order(&app);
  if let Some(entry) = order.get_mut(&dir_key(&path)) {
    entry.files.retain(|n| *n != name);
  }
  order
    .entry(dir_key(&new_rel))
    .or_default()
    .files
    .push(name);
  save_order(&app, &order)
}

#[tauri::command]
fn move_folder_to_dir(
  app: tauri::AppHandle,
  path: String,
  target_dir: Option<String>,
) -> Result<(), String> {
  let path = sanitize_rel_path(&path)?;
  let target_dir = sanitize_dir_path(target_dir)?;
  if target_dir == path || target_dir.starts_with(&format!("{}/", path)) {
    return Err("cannot move folder into itself".to_string());
  }
  let name = last_seg(&path).to_string();
  let new_rel = if target_dir.is_empty() {
    name.clone()
  } else {
    format!("{}/{}", target_dir, name)
  };
  if new_rel == path {
    return Ok(());
  }
  let source = entry_path(&app, &path)?;
  if !source.is_dir() {
    return Err("folder not found".to_string());
  }
  let target = entry_path(&app, &new_rel)?;
  if target.exists() {
    return Err("target folder already exists".to_string());
  }
  fs::rename(source, target).map_err(|e| e.to_string())?;
  // 索引迁移（键前缀替换 + 新旧父目录的子文件夹列表增删）已由
  // order_migrate_dir_prefix 完整处理，这里不能重复 push，否则目标目录出现重复条目
  let mut order = load_order(&app);
  order_migrate_dir_prefix(&mut order, &path, &new_rel);
  save_order(&app, &order)
}

/// 拖动排序后持久化各目录的条目顺序
#[tauri::command]
fn reorder_items(app: tauri::AppHandle, order: OrderMap) -> Result<(), String> {
  save_order(&app, &order)
}

// ---------------------------------------------------------------------------
// 数据目录与回收站保留天数
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_trash_retention_days(app: tauri::AppHandle) -> Result<u32, String> {
  Ok(trash_retention_days(&app))
}

#[tauri::command]
fn set_trash_retention_days(app: tauri::AppHandle, days: u32) -> Result<(), String> {
  let mut settings = load_settings(&app);
  settings.trash_retention_days = Some(days.max(1));
  save_settings(&app, &settings)
}

#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
  files_dir(&app).map(|dir| dir.to_string_lossy().to_string())
}

#[tauri::command]
fn get_default_data_dir(app: tauri::AppHandle) -> Result<String, String> {
  default_files_dir(&app).map(|dir| dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let (tx, mut rx) = tauri::async_runtime::channel::<Option<String>>(1);
  app.dialog().file().pick_folder(move |file_path| {
    let selected = file_path.and_then(|path| match path {
      tauri_plugin_dialog::FilePath::Path(p) => Some(p.to_string_lossy().to_string()),
      _ => None,
    });
    let _ = tx.blocking_send(selected);
  });
  rx.recv()
    .await
    .ok_or_else(|| "failed to pick folder".to_string())
}

#[tauri::command]
fn set_data_dir(app: tauri::AppHandle, path: String) -> Result<SetDataDirResult, String> {
  let new_dir = PathBuf::from(path.trim());
  if new_dir.as_os_str().is_empty() {
    return Err("invalid path".to_string());
  }
  if !new_dir.exists() {
    fs::create_dir_all(&new_dir).map_err(|e| e.to_string())?;
  }
  let old_dir = files_dir(&app)?;
  let mut migrated_files = 0u64;
  if old_dir != new_dir {
    migrate_data_dir(&old_dir, &new_dir, &mut migrated_files)?;
  }
  let mut settings = load_settings(&app);
  settings.custom_data_dir = Some(new_dir.to_string_lossy().to_string());
  save_settings(&app, &settings)?;
  Ok(SetDataDirResult {
    data_dir: new_dir.to_string_lossy().to_string(),
    migrated_files,
  })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SetDataDirResult {
  data_dir: String,
  migrated_files: u64,
}

/// 迁移数据目录：递归复制 .drawnix 文件（保留目录结构）与索引文件
fn migrate_data_dir(old_dir: &Path, new_dir: &Path, migrated: &mut u64) -> Result<(), String> {
  // 索引文件一并迁移，目录顺序不丢失
  let index_source = old_dir.join(INDEX_FILE_NAME);
  if index_source.exists() {
    fs::copy(&index_source, new_dir.join(INDEX_FILE_NAME)).map_err(|e| e.to_string())?;
  }
  for entry in fs::read_dir(old_dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let source = entry.path();
    let name = source.file_name().unwrap_or_default().to_string_lossy().to_string();
    if name == INDEX_FILE_NAME || name.starts_with('.') {
      continue;
    }
    if source.is_dir() {
      let target_dir = new_dir.join(&name);
      fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
      migrate_data_dir(&source, &target_dir, migrated)?;
    } else if source.extension().map(|ext| ext == "drawnix").unwrap_or(false) {
      fs::copy(&source, new_dir.join(&name)).map_err(|e| e.to_string())?;
      *migrated += 1;
    }
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.handle().plugin(tauri_plugin_dialog::init())?;
      cleanup_expired_trash(app.handle());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_tree,
      read_drawnix_file,
      write_drawnix_file,
      rename_drawnix_file,
      delete_drawnix_file,
      create_folder,
      rename_folder,
      delete_folder,
      move_file_to_dir,
      move_folder_to_dir,
      reorder_items,
      list_trash_files,
      restore_drawnix_file,
      empty_trash,
      get_trash_retention_days,
      set_trash_retention_days,
      get_data_dir,
      get_default_data_dir,
      pick_folder,
      set_data_dir
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
