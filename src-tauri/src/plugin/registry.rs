use super::{ExportPlugin, ImportPlugin, PluginInfo};

/// Central registry holding all import and export plugins (built-in and Rhai scripts).
#[derive(Default)]
pub struct PluginRegistry {
    importers: Vec<Box<dyn ImportPlugin>>,
    exporters: Vec<Box<dyn ExportPlugin>>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_importer(&mut self, plugin: Box<dyn ImportPlugin>) {
        self.importers.push(plugin);
    }

    pub fn register_exporter(&mut self, plugin: Box<dyn ExportPlugin>) {
        self.exporters.push(plugin);
    }

    pub fn list_importers(&self) -> Vec<PluginInfo> {
        self.importers.iter().map(|p| p.info()).collect()
    }

    pub fn list_exporters(&self) -> Vec<PluginInfo> {
        self.exporters.iter().map(|p| p.info()).collect()
    }

    pub fn find_importer(&self, id: &str) -> Option<&dyn ImportPlugin> {
        self.importers
            .iter()
            .find(|p| p.info().id == id)
            .map(|p| p.as_ref())
    }

    pub fn find_exporter(&self, id: &str) -> Option<&dyn ExportPlugin> {
        self.exporters
            .iter()
            .find(|p| p.info().id == id)
            .map(|p| p.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;

    struct DummyImporter;
    impl ImportPlugin for DummyImporter {
        fn info(&self) -> PluginInfo {
            PluginInfo {
                id: "test:dummy-import".into(),
                name: "Dummy Importer".into(),
                file_extensions: vec!["txt".into()],
                builtin: false,
            }
        }
        fn parse(&self, _content: &str) -> Result<Vec<DiaryEntry>, String> {
            Ok(vec![])
        }
    }

    struct DummyExporter;
    impl ExportPlugin for DummyExporter {
        fn info(&self) -> PluginInfo {
            PluginInfo {
                id: "test:dummy-export".into(),
                name: "Dummy Exporter".into(),
                file_extensions: vec!["txt".into()],
                builtin: false,
            }
        }
        fn export(&self, _entries: Vec<DiaryEntry>) -> Result<String, String> {
            Ok(String::new())
        }
    }

    #[test]
    fn test_register_and_list_importers() {
        let mut reg = PluginRegistry::new();
        reg.register_importer(Box::new(DummyImporter));
        let list = reg.list_importers();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "test:dummy-import");
    }

    #[test]
    fn test_register_and_list_exporters() {
        let mut reg = PluginRegistry::new();
        reg.register_exporter(Box::new(DummyExporter));
        let list = reg.list_exporters();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "test:dummy-export");
    }

    #[test]
    fn test_find_importer() {
        let mut reg = PluginRegistry::new();
        reg.register_importer(Box::new(DummyImporter));
        assert!(reg.find_importer("test:dummy-import").is_some());
        assert!(reg.find_importer("nonexistent").is_none());
    }

    #[test]
    fn test_find_exporter() {
        let mut reg = PluginRegistry::new();
        reg.register_exporter(Box::new(DummyExporter));
        assert!(reg.find_exporter("test:dummy-export").is_some());
        assert!(reg.find_exporter("nonexistent").is_none());
    }

    #[test]
    fn test_empty_registry() {
        let reg = PluginRegistry::new();
        assert_eq!(reg.list_importers().len(), 0);
        assert_eq!(reg.list_exporters().len(), 0);
    }
}
