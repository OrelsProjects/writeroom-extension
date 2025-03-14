# Migration from Redux to Chrome Storage and Background Script

This document outlines the changes made to migrate the state management from Redux to Chrome's storage API and move API requests to the background script for better compatibility with Chrome extensions.

## Files Created/Modified

1. **New Files:**
   - `src/lib/storage/chromeStorage.ts` - Core utility for Chrome storage operations
   - `src/lib/storage/migrateFromRedux.ts` - Utility to migrate data from Redux to Chrome storage
   - `src/lib/hooks/useChromeStorage.ts` - React hooks for using Chrome storage

2. **Modified Files:**
   - `src/lib/hooks/useIdea.ts` - Updated to use Chrome storage hooks and background script for API requests
   - `src/content/background.ts` - Added initialization, migration code, and API request handlers

## Key Changes

### 1. Chrome Storage Utility (`chromeStorage.ts`)

- Created a `StorageState` interface to define the shape of our storage
- Implemented functions for getting, setting, and updating state
- Added listener management for storage changes

### 2. Migration Utility (`migrateFromRedux.ts`)

- Created a utility to migrate data from Redux (localStorage) to Chrome storage
- Handles mapping between Redux state structure and Chrome storage structure
- Ensures migration only happens once

### 3. React Hooks (`useChromeStorage.ts`)

- Created a base `useChromeStorage` hook for general state management
- Implemented specialized hooks:
  - `useIdeas` - For managing ideas (listing, selecting, updating)
  - `useSettings` - For managing settings (usage counts)
  - `useUI` - For managing UI state (panel visibility)

### 4. Updated Idea Hook (`useIdea.ts`)

- Replaced Redux dispatch calls with Chrome storage operations
- Moved API calls to the background script using message passing
- Added proper async/await handling for all storage operations
- Implemented optimistic updates with rollback on errors

### 5. Background Script (`background.ts`)

- Added initialization code to run when the extension starts
- Performs migration from Redux if needed
- Initializes the Chrome storage state
- Centralized all API requests in the background script
- Implemented a message passing system for communication with content scripts

## Benefits of the Migration

1. **Better Compatibility:** Chrome's storage API and background script architecture are designed specifically for extensions
2. **Persistence:** Data persists across browser sessions automatically
3. **Synchronization:** Changes are automatically synchronized across all extension contexts
4. **Performance:** Reduced overhead compared to Redux in extension context
5. **Simplicity:** More direct API without middleware or complex store setup
6. **Security:** API requests are handled in the background script, not in content scripts
7. **Reliability:** Network operations are isolated from the UI thread

## Architecture Overview

### Message Passing

The extension now uses Chrome's message passing system for communication:

1. **Content Script → Background Script**: Sends API requests
   ```typescript
   chrome.runtime.sendMessage({ 
     type: "API_REQUEST", 
     action: "updateIdeaStatus", 
     params: [ideaId, status] 
   });
   ```

2. **Background Script → Content Script**: Returns API responses
   ```typescript
   sendResponse({ success: true, data: result });
   ```

### State Management

1. **Chrome Storage**: Stores application state
   - Ideas, selected idea, settings, UI state
   - Automatically synced across contexts

2. **Background Script**: Handles API requests
   - Centralizes all network operations
   - Provides a consistent API interface

3. **React Hooks**: Provide access to state
   - Read from Chrome storage
   - Update Chrome storage
   - Send messages to background script for API operations

## How to Use the New System

### Basic Usage

```typescript
// Import the hooks
import { useIdeas, useSettings, useUI } from './lib/hooks/useChromeStorage';
import { useIdea } from './lib/hooks/useIdea';

// In your component
const MyComponent = () => {
  const { ideas, selectedIdea } = useIdeas();
  const { updateStatus, generateIdeas } = useIdea();
  
  const handleGenerateIdeas = async () => {
    try {
      // This will call the background script and update storage
      const newIdeas = await generateIdeas({ topic: "AI", ideasCount: 5 });
      console.log("Generated ideas:", newIdeas);
    } catch (error) {
      console.error("Error generating ideas:", error);
    }
  };
  
  // Use the state and functions as needed
  return (
    <div>
      <button onClick={handleGenerateIdeas}>Generate Ideas</button>
      {ideas.map(idea => (
        <div 
          key={idea.id}
          onClick={() => updateStatus(idea.id, "favorite")}
        >
          {idea.title}
        </div>
      ))}
    </div>
  );
};
```

### Advanced Usage

For direct access to Chrome storage, you can use the utilities in `chromeStorage.ts`:

```typescript
import { getState, setState, updateState } from './lib/storage/chromeStorage';

// Get the entire state
const state = await getState();

// Update a specific part of the state
await updateState(state => ({
  ...state,
  ui: {
    ...state.ui,
    showIdeasPanel: true
  }
}));
```

For direct communication with the background script:

```typescript
// Send a message to the background script
chrome.runtime.sendMessage(
  { type: "API_REQUEST", action: "generateIdeas", params: ["AI", 5, false] },
  (response) => {
    if (response && response.success) {
      console.log("Generated ideas:", response.data);
    } else {
      console.error("Error:", response?.error);
    }
  }
);
```

## Next Steps

1. Remove Redux dependencies from `package.json`
2. Remove Redux store configuration files
3. Test thoroughly to ensure all functionality works as expected 