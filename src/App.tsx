import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Meal, Ingredient } from '@/types';
import { generateId, DEFAULT_INITIAL_MEALS } from '@/constants';
import MealComponent from '@/components/MealComponent';
import { ChefHat, PlusCircle, Loader2, AlertCircle, Check, Link, FileUp, FileDown, Unlink, UploadCloud, DownloadCloud } from '@/components/icons';

const LOCAL_DATA_KEY = 'mealPlannerProDefaultUser'; // Key for single-user data
const IDB_NAME = 'MealPlannerProDB_SingleUser'; // Changed DB name to avoid conflicts with old structure
const IDB_VERSION = 1;
const IDB_STORE_HANDLES = 'fileHandles';
const IDB_STORE_MEALS_BACKUP = 'mealsBackup';

// --- IndexedDB Utility Functions ---
interface FileHandleStoreEntry {
  key: string; // Will always be LOCAL_DATA_KEY
  handle: FileSystemFileHandle;
}

interface MealsBackupStoreEntry {
  key: string; // Will always be LOCAL_DATA_KEY
  meals: Meal[];
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject("Error opening IndexedDB.");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_HANDLES)) {
        db.createObjectStore(IDB_STORE_HANDLES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(IDB_STORE_MEALS_BACKUP)) {
        db.createObjectStore(IDB_STORE_MEALS_BACKUP, { keyPath: 'key' });
      }
    };
  });
};

const storeFileHandleInDB = async (key: string, handle: FileSystemFileHandle): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE_HANDLES, 'readwrite');
    const store = transaction.objectStore(IDB_STORE_HANDLES);
    const request = store.put({ key, handle });
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Error storing file handle.");
    transaction.oncomplete = () => db.close();
  });
};

const retrieveFileHandleFromDB = async (key: string): Promise<FileSystemFileHandle | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE_HANDLES, 'readonly');
    const store = transaction.objectStore(IDB_STORE_HANDLES);
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result as FileHandleStoreEntry | undefined;
      resolve(result ? result.handle : null);
    };
    request.onerror = () => reject("Error retrieving file handle.");
    transaction.oncomplete = () => db.close();
  });
};

const deleteFileHandleFromDB = async (key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE_HANDLES, 'readwrite');
    const store = transaction.objectStore(IDB_STORE_HANDLES);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Error deleting file handle.");
    transaction.oncomplete = () => db.close();
  });
};

const verifyAndRequestPermission = async (fileHandle: FileSystemFileHandle, readWrite: boolean): Promise<boolean> => {
  const options: FileSystemHandlePermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if (await fileHandle.queryPermission(options) === 'granted') {
      return true;
    }
    if (await fileHandle.requestPermission(options) === 'granted') {
      return true;
    }
  } catch (e) {
    console.warn("Permission query/request failed, possibly due to API nuances or secure context issues.", e);
    return false;
  }
  return false;
};

const saveMealsToIDBBackup = async (key: string, mealsToSave: Meal[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_MEALS_BACKUP, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_MEALS_BACKUP);
        const request = store.put({ key, meals: mealsToSave });
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Error saving meals to IDB backup.");
        transaction.oncomplete = () => db.close();
    });
};

const loadMealsFromIDBBackup = async (key: string): Promise<Meal[] | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_MEALS_BACKUP, 'readonly');
        const store = transaction.objectStore(IDB_STORE_MEALS_BACKUP);
        const request = store.get(key);
        request.onsuccess = () => {
            const result = request.result as MealsBackupStoreEntry | undefined;
            resolve(result ? result.meals : null);
        };
        request.onerror = () => reject("Error loading meals from IDB backup.");
        transaction.oncomplete = () => db.close();
    });
};


// --- App Component ---
function App() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true); // Start true to load data on init
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSavingToFile, setIsSavingToFile] = useState(false);

  const importFileRef = useRef<HTMLInputElement>(null);

  const isFileSystemAccessAPISupported = 'showSaveFilePicker' in window && 
                                       'FileSystemFileHandle' in window &&
                                       typeof window.FileSystemFileHandle.prototype.createWritable === 'function';


  // Clear messages after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 7000);
      return () => clearTimeout(timer);
    }
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  // Load data (from file or IDB backup) on initial app load
  useEffect(() => {
    setIsLoadingData(true);
    setError(null);

    const loadData = async () => {
      try {
        if (isFileSystemAccessAPISupported) {
            const handle = await retrieveFileHandleFromDB(LOCAL_DATA_KEY);
            if (handle) {
                if (await verifyAndRequestPermission(handle, true)) {
                    setFileHandle(handle);
                    setFileName(handle.name);
                    setSuccessMessage(`Loading data from ${handle.name}...`);
                    const file = await handle.getFile();
                    const content = await file.text();
                    if (content) {
                        const parsedMeals = JSON.parse(content) as Meal[];
                        setMeals(parsedMeals.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
                        setSuccessMessage(`Data loaded from ${handle.name}.`);
                        await saveMealsToIDBBackup(LOCAL_DATA_KEY, parsedMeals);
                        setIsLoadingData(false);
                        return;
                    } else { 
                        const defaultUserMeals = DEFAULT_INITIAL_MEALS.map(m => ({ ...m, createdAt: Date.now() }));
                        setMeals(defaultUserMeals);
                        setSuccessMessage(`Linked file ${handle.name} is empty. Started with default meals. Changes will save to this file.`);
                        await saveMealsToFile(handle, defaultUserMeals); 
                        await saveMealsToIDBBackup(LOCAL_DATA_KEY, defaultUserMeals);
                        setIsLoadingData(false);
                        return;
                    }
                } else {
                    setError(`Permission denied for ${handle.name}. Please re-link the file or allow access. Falling back to local browser storage.`);
                    await deleteFileHandleFromDB(LOCAL_DATA_KEY);
                    setFileHandle(null);
                    setFileName(null);
                }
            }
        }

        const backupMeals = await loadMealsFromIDBBackup(LOCAL_DATA_KEY);
        if (backupMeals) {
            setMeals(backupMeals.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
            setSuccessMessage("Data loaded from local browser backup.");
        } else {
            const defaultUserMeals = DEFAULT_INITIAL_MEALS.map(m => ({ ...m, createdAt: Date.now() }));
            setMeals(defaultUserMeals);
            await saveMealsToIDBBackup(LOCAL_DATA_KEY, defaultUserMeals);
            if (!isFileSystemAccessAPISupported) {
                setSuccessMessage("Started with default meals. Data saved in browser. Direct file saving not supported by this browser/context (requires HTTPS or localhost).");
            } else {
                 setSuccessMessage("Started with default meals. Link a file to save data to your device, or use Import/Export.");
            }
        }
      } catch (e: any) {
        console.error("Failed to load data:", e);
        setError(`Error loading data: ${e.message}. Using local browser storage or defaults.`);
        const backupMealsOnError = await loadMealsFromIDBBackup(LOCAL_DATA_KEY);
        setMeals(backupMealsOnError || DEFAULT_INITIAL_MEALS.map(m => ({ ...m, createdAt: Date.now() })));
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [isFileSystemAccessAPISupported]); // Run once on mount, and if API support changes (unlikely after init)


  const saveMealsToFile = async (handle: FileSystemFileHandle, currentMeals: Meal[]) => {
    if (!handle || !isFileSystemAccessAPISupported) return false;
    setIsSavingToFile(true);
    setError(null);
    try {
      if (!(await verifyAndRequestPermission(handle, true))) {
        setError(`Permission denied to write to ${handle.name}. Changes not saved to file. Data saved to browser backup.`);
        setFileHandle(null); 
        setFileName(null);
        await deleteFileHandleFromDB(LOCAL_DATA_KEY);
        await saveMealsToIDBBackup(LOCAL_DATA_KEY, currentMeals);
        setIsSavingToFile(false);
        return false;
      }
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(currentMeals, null, 2));
      await writable.close();
      setSuccessMessage(`Data saved to ${handle.name}.`);
      await saveMealsToIDBBackup(LOCAL_DATA_KEY, currentMeals);
      setIsSavingToFile(false);
      return true;
    } catch (e: any) {
      console.error("Failed to save to file:", e);
      setError(`Error saving to ${handle.name}: ${e.message}. Data saved to browser backup.`);
      await saveMealsToIDBBackup(LOCAL_DATA_KEY, currentMeals);
      setIsSavingToFile(false);
      return false;
    }
  };

  // Auto-save meals
  useEffect(() => {
    // Do not save if initial data is loading or meals array is empty (e.g. after initial load with no data)
    if (isLoadingData || (meals.length === 0 && !fileHandle)) return; 
    
    const debounceSave = setTimeout(async () => {
        if (isFileSystemAccessAPISupported && fileHandle) {
          await saveMealsToFile(fileHandle, meals);
        } else { 
          try {
            await saveMealsToIDBBackup(LOCAL_DATA_KEY, meals);
          } catch (e: any) {
            setError(`Failed to save data to browser backup: ${e.message}`);
          }
        }
    }, 1000); 

    return () => clearTimeout(debounceSave);

  }, [meals, fileHandle, isLoadingData, isFileSystemAccessAPISupported]);


  const handleChooseFileLocation = async () => {
    if (!isFileSystemAccessAPISupported) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const suggestedName = `shivs_meal_planner_data.json`;
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });
      setFileHandle(handle);
      setFileName(handle.name);
      await storeFileHandleInDB(LOCAL_DATA_KEY, handle);
      setSuccessMessage(`Data will now be saved to ${handle.name}.`);
      await saveMealsToFile(handle, meals); // Initial save to the new file
    } catch (e: any) {
      console.error("File picker error:", e);
      if (e.name !== 'AbortError') { 
        setError(`Could not link file: ${e.message}. Ensure you are on HTTPS or localhost.`);
      }
    }
  };

  const handleUnlinkFile = async () => {
    if (!fileHandle) return;
    const oldFileName = fileName;
    setFileHandle(null);
    setFileName(null);
    try {
      await deleteFileHandleFromDB(LOCAL_DATA_KEY);
      setSuccessMessage(`Stopped syncing to ${oldFileName}. Data will be saved in browser storage only.`);
    } catch (e: any) {
      setError(`Error unlinking file: ${e.message}`);
    }
  };

  const handleExportData = useCallback(async () => {
    if (meals.length === 0) {
      setError("No data to export.");
      return;
    }
    try {
      const dataStr = JSON.stringify(meals, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `shivs_meal_planner_data_${date}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMessage("Data exported successfully!");
    } catch (e: any) {
      console.error("Export error:", e);
      setError(`Failed to export data: ${e.message}`);
    }
  }, [meals]);

  const handleImportFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        setError("Invalid file type. Please select a JSON file (.json).");
        if(importFileRef.current) importFileRef.current.value = ""; 
        return;
    }

    const confirmed = window.confirm(
        `Importing data from "${file.name}" will replace all your current meals. Are you sure?`
    );
    if (!confirmed) {
        if(importFileRef.current) importFileRef.current.value = "";
        return;
    }
    
    setIsLoadingData(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      if (!Array.isArray(importedData) || !importedData.every(item => 'id' in item && 'name' in item && 'ingredients' in item && 'createdAt' in item)) {
        throw new Error("Invalid file structure. The file must contain an array of Meal objects.");
      }
      
      const validMeals = importedData as Meal[];
      validMeals.forEach(meal => { 
        if (!Array.isArray(meal.ingredients) || !meal.ingredients.every(ing => 'id' in ing && 'name' in ing)) {
            throw new Error(`Invalid ingredients structure in meal: ${meal.name}`);
        }
      });

      setMeals(validMeals.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)));
      await saveMealsToIDBBackup(LOCAL_DATA_KEY, validMeals);
      if (fileHandle) { // If a file was previously linked, save imported data to it too
        await saveMealsToFile(fileHandle, validMeals);
      }
      setSuccessMessage(`Data imported successfully from ${file.name}!`);
    } catch (e: any) {
      console.error("Import error:", e);
      setError(`Failed to import data: ${e.message}`);
    } finally {
      if(importFileRef.current) importFileRef.current.value = ""; 
      setIsLoadingData(false);
    }
  }, [fileHandle]); // Added fileHandle dependency for saving imported data to linked file

  const handleAddMeal = useCallback((mealToDuplicate: Meal | null = null) => {
    let newMeal: Meal;
    if (mealToDuplicate) {
      newMeal = {
        ...mealToDuplicate,
        id: generateId(),
        name: `${mealToDuplicate.name} (Copy)`,
        ingredients: mealToDuplicate.ingredients.map(ing => ({ ...ing, id: generateId() })),
        createdAt: Date.now()
      };
    } else {
      newMeal = {
        id: generateId(),
        name: `Meal ${meals.length + 1}`,
        ingredients: [],
        createdAt: Date.now()
      };
    }
    setMeals(prevMeals => [...prevMeals, newMeal].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
  }, [meals.length]);

  const handleRemoveMeal = useCallback((mealId: string) => {
    setMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealId));
  }, []);

  const handleUpdateMealName = useCallback((mealId: string, newName: string) => {
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId ? { ...meal, name: newName } : meal
      ).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    );
  }, []);

  const handleAddIngredient = useCallback((mealId: string, ingredientData?: Partial<Ingredient>) => {
    const newIngredient: Ingredient = {
      id: generateId(),
      name: '',
      calories100g: 0,
      protein100g: 0,
      fat100g: 0,
      carbs100g: 0,
      grams: 0,
      ...ingredientData,
    };
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId ? { ...meal, ingredients: [...meal.ingredients, newIngredient] } : meal
      ).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    );
  }, []);

  const handleRemoveIngredient = useCallback((mealId: string, ingredientId: string) => {
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId ? { ...meal, ingredients: meal.ingredients.filter(ing => ing.id !== ingredientId) } : meal
      ).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    );
  }, []);

  const handleUpdateIngredient = useCallback((mealId: string, ingredientId: string, updatedValues: Partial<Ingredient>) => {
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId ? {
          ...meal,
          ingredients: meal.ingredients.map(ing =>
            ing.id === ingredientId ? { ...ing, ...updatedValues } : ing
          )
        } : meal
      ).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    );
  }, []);


  if (isLoadingData && meals.length === 0) { // Show loading only if there are no meals yet
     return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <Loader2 className="animate-spin mr-2 h-8 w-8 text-sky-400" />
        <div className="text-xl">Loading Your Meal Data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-6">
        <div className="flex items-center justify-center mb-1">
          <ChefHat size={48} className="text-sky-400 mr-3" />
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Shiv's Meal Planner</h1>
        </div>
         <p className="text-sm text-slate-400 text-center mb-3">Your personal meal planning assistant.</p>
            
        {/* File System Access API UI or Import/Export Fallback */}
        <div className="mt-3 text-sm text-center">
          {isFileSystemAccessAPISupported ? (
            fileHandle && fileName ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-green-400 flex items-center">
                  <Link size={16} className="mr-2" /> Data synced to: <strong className="ml-1">{fileName}</strong>
                  {isSavingToFile && <Loader2 size={16} className="animate-spin ml-2" />}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleChooseFileLocation}
                    className="text-yellow-400 hover:text-yellow-300 py-1 px-2 border border-yellow-500/50 hover:border-yellow-400 rounded-md text-xs flex items-center"
                    aria-label="Change save file location"
                  >
                    <FileUp size={14} className="mr-1"/> Change Location
                  </button>
                  <button
                    onClick={handleUnlinkFile}
                    className="text-red-400 hover:text-red-300 py-1 px-2 border border-red-500/50 hover:border-red-400 rounded-md text-xs flex items-center"
                    aria-label="Stop syncing to file"
                  >
                    <Unlink size={14} className="mr-1"/> Stop Syncing
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleChooseFileLocation}
                className="flex items-center mx-auto text-orange-400 hover:text-orange-300 transition-colors py-1 px-3 border border-orange-500/50 hover:border-orange-400 rounded-md"
                aria-label="Link data file to save on device"
              >
                <FileDown size={16} className="mr-2" /> Link Data File to Device
              </button>
            )
          ) : (
            // Fallback to Import/Export buttons
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-2">
               <p className="text-xs text-orange-400 mb-2 sm:mb-0 sm:mr-4">Direct file sync not supported by this browser/context.</p>
               <div className="flex gap-2">
                <button
                    onClick={() => importFileRef.current?.click()}
                    className="text-sky-400 hover:text-sky-300 py-1 px-2 border border-sky-500/50 hover:border-sky-400 rounded-md text-xs flex items-center"
                    aria-label="Import data from file"
                >
                    <UploadCloud size={14} className="mr-1"/> Import Data
                </button>
                <input type="file" ref={importFileRef} onChange={handleImportFileSelected} accept=".json" style={{ display: 'none' }} />
                <button
                    onClick={handleExportData}
                    disabled={meals.length === 0}
                    className="text-teal-400 hover:text-teal-300 py-1 px-2 border border-teal-500/50 hover:border-teal-400 rounded-md text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Export data to file"
                >
                    <DownloadCloud size={14} className="mr-1"/> Export Data
                </button>
               </div>
            </div>
          )}
        </div>
        
        {error && (
            <div className="mt-4 p-3 bg-red-800/50 border border-red-700 rounded-md text-red-300 flex items-center justify-center max-w-lg mx-auto text-sm" role="alert">
                <AlertCircle size={20} className="mr-2 flex-shrink-0" /> 
                <span>{error}</span>
            </div>
        )}
        {successMessage && (
             <div className="mt-4 p-3 bg-green-800/50 border border-green-700 rounded-md text-green-300 flex items-center justify-center max-w-lg mx-auto text-sm" role="status">
                <Check size={20} className="mr-2 flex-shrink-0" /> 
                <span>{successMessage}</span>
            </div>
        )}
      </header>

      {meals.length === 0 && !isLoadingData && (
        <div className="text-center py-10 px-4">
            <p className="text-xl text-slate-400 mb-4">No meals planned yet.</p>
            <p className="text-slate-500 mb-6">Get started by adding a new meal.
            {isFileSystemAccessAPISupported && !fileHandle && " You can link a data file to save your progress directly on your device, "}
            {!isFileSystemAccessAPISupported && " You can use the Import/Export buttons to manage your data, "}
            or your data will be saved in this browser.
            </p>
        </div>
      )}

      {meals.map(meal => (
        <MealComponent
          key={meal.id}
          meal={meal}
          onDuplicateMeal={() => handleAddMeal(meal)}
          onRemoveMeal={handleRemoveMeal}
          onUpdateMealName={handleUpdateMealName}
          onAddIngredient={handleAddIngredient}
          onRemoveIngredient={handleRemoveIngredient}
          onUpdateIngredient={handleUpdateIngredient}
        />
      ))}

      <div className="mt-8 flex justify-center">
        <button
          onClick={() => handleAddMeal()}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center text-lg"
          disabled={isLoadingData && meals.length === 0} // Disable if still initially loading and no meals shown
        >
          <PlusCircle size={24} className="mr-2" /> Add New Meal
        </button>
      </div>
       <footer className="text-center text-slate-500 mt-12 py-4 border-t border-slate-700 text-sm">
          <p>&copy; {new Date().getFullYear()} Shiv's Meal Planner. 
          {isFileSystemAccessAPISupported && fileHandle && fileName ? ` Data is synced to ${fileName}.` 
            : ` Data is saved locally in your browser's internal storage.`
          }
          </p>
          {!isFileSystemAccessAPISupported && <p className="text-xs text-orange-400 mt-1">This browser/context does not support direct file saving (requires HTTPS or localhost). Please use Import/Export for data portability. Data is stored in browser's internal storage.</p>}
      </footer>
    </div>
  );
}

export default App;
