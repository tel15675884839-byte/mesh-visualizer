
import { useSiteStore } from '../store/useSiteStore';
import { useTopologyStore } from '../store/useTopologyStore';
import { useUIStore } from '../store/useUIStore';
import { exportProject, importProject } from '../utils/storage';

class FileServiceImpl {
  
  // Main Entry Point
  async openFileFlow(fileInput: HTMLInputElement) {
    const siteStore = useSiteStore.getState();

    // 1. Check if we need to save current work
    if (siteStore.isProjectOpen && siteStore.hasUnsavedChanges) {
      const choice = await useUIStore.getState().confirm({
        title: 'Save Changes?',
        message: 'Do you want to save changes to the current project before opening a new one?',
        type: 'warning'
      });

      if (choice === 'CANCEL') {
        // Reset input so user can try again
        fileInput.value = '';
        return;
      }

      if (choice === 'SAVE') {
        await this.handleSave();
        // After save, proceed to open (User gesture chain is tricky here, but we try)
      }
      
      // If 'DISCARD', we just proceed
    }

    // 2. Trigger File Picker
    // Note: If this was async waited, some browsers might block the popup.
    // However, since the "Confirm" choice comes from a fresh user click in the modal, 
    // it usually propagates the user gesture permissions.
    fileInput.click();
  }

  // Handle the actual file loading after selection
  async handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const { topology, site } = await importProject(content);
        
        // Hydrate
        useTopologyStore.setState(topology);
        useSiteStore.getState().loadState(site);
        
        // Mark as clean
        useSiteStore.getState().markSaved();
        
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : 'Failed to load project file.');
      } finally {
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsText(file);
  }

  async handleSave() {
    const data = await exportProject(useTopologyStore.getState(), useSiteStore.getState());
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesh-project-${Date.now()}.mesh`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Mark as saved
    useSiteStore.getState().markSaved();
  }

  // Unified flow for creating a new project
  async newProjectFlow(onSuccess: () => void) {
    const siteStore = useSiteStore.getState();

    // Check for unsaved changes
    if (siteStore.isProjectOpen && siteStore.hasUnsavedChanges) {
      const choice = await useUIStore.getState().confirm({
        title: 'Save Changes?',
        message: 'Do you want to save changes to the current project before creating a new one?',
        type: 'warning'
      });

      if (choice === 'CANCEL') return;

      if (choice === 'SAVE') {
        await this.handleSave();
      }
      // If DISCARD, proceed without saving
    }

    // Reset Logic
    siteStore.createProject();
    useTopologyStore.getState().clearAll();
    
    // Trigger Success Callback (e.g. Open Site Manager)
    onSuccess();
  }

}

export const FileService = new FileServiceImpl();
