
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
        title: 'Unsaved Changes',
        message: 'The current project has unsaved changes. Do you want to save them before opening a new file?',
        type: 'warning'
      });

      if (choice === 'CANCEL') {
        // Reset input so user can try again
        fileInput.value = '';
        return;
      }

      if (choice === 'SAVE') {
        await this.handleSave();
        // Continue to open...
      }
      
      // If 'DISCARD', we just proceed
    }

    // 2. Trigger File Picker (Programmatically click the hidden input passed in)
    // Note: Since browsers require user gesture for file picker, 
    // we assume the user ALREADY clicked "Open", and we are intercepting the logic.
    // However, we can't pause the click event.
    
    // REVISED FLOW:
    // The "Open" button should call this function.
    // If the check passes, WE trigger the click on the input.
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
        alert('Failed to load project file.');
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
}

export const FileService = new FileServiceImpl();
