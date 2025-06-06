
// Firebase and Auth imports
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc, query, where, documentId } from "firebase/firestore";

// React and Type imports
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MealTemplate, MealInstance, Ingredient, ShoppingListItem, DayPlan, MealAssignment, NutrientTotals } from './types';
import { generateId, DEFAULT_INITIAL_MEALS, round } from './constants';
import MealComponent from './components/MealComponent';
import { Auth } from "./Auth";
import {
  ChefHat, PlusCircle, Loader2, AlertCircle, Check, LogOut as LogOutIcon, UserCircle, X,
  Search, ShoppingCart, ListChecks, Printer, Trash2, ChevronLeft, ChevronRight,
  BookOpen, Edit, CalendarDays, Eye, Save, Copy, Star // Added Copy, Star
} from './components/icons';


// --- Helper Functions ---
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getWeekDates = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + i);
    dates.push(nextDate);
  }
  return dates;
};

const getDayName = (date: Date, Datalength: 'short' | 'long' = 'short'): string => {
  return date.toLocaleDateString(undefined, { weekday: Datalength });
};


// --- App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [allMealTemplates, setAllMealTemplates] = useState<MealTemplate[]>([]); // Meal Library
  const [loadedMealInstances, setLoadedMealInstances] = useState<{ [instanceId: string]: MealInstance }>({});
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  const [dailyPlansData, setDailyPlansData] = useState<{ [dateKey: string]: DayPlan }>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal States & Expanded Day
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [isMealLibraryModalOpen, setIsMealLibraryModalOpen] = useState(false);
  
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate | null>(null); // For MealComponent in library modal
  const [editingInstance, setEditingInstance] = useState<MealInstance | null>(null); // For MealComponent for a day's meal instance
  const [creatingInstanceForDate, setCreatingInstanceForDate] = useState<string | null>(null); // YYYY-MM-DD, for new quick meal

  const [assignTemplateToDate, setAssignTemplateToDate] = useState<string | null>(null); // YYYY-MM-DD for assigning from library

  // --- Derived State ---
  const currentWeekStartDate = useMemo(() => {
    const dayOfWeek = currentDisplayDate.getDay();
    const diff = currentDisplayDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const newDate = new Date(currentDisplayDate); // Create a new Date object
    newDate.setDate(diff); // Set the date on the new object
    return newDate;
  }, [currentDisplayDate]);
  
  const weekDates = useMemo(() => getWeekDates(currentWeekStartDate), [currentWeekStartDate]);

  // --- Authentication & Data Loading/Saving ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser);
      } else {
        setAllMealTemplates(DEFAULT_INITIAL_MEALS.map(m => ({ ...m, createdAt: m.createdAt || Date.now() })));
        setDailyPlansData({});
        setLoadedMealInstances({});
        setIsLoading(false);
        setSuccessMessage("Using default meal templates. Sign in to save and sync your plans.");
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (currentUser: User) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage("Syncing your data...");
    try {
      // Load Meal Library (Templates)
      const mealLibraryRef = doc(db, "mealLibraries", currentUser.uid);
      const mealLibrarySnap = await getDoc(mealLibraryRef);
      let currentTemplates: MealTemplate[] = [];
      if (mealLibrarySnap.exists()) {
        currentTemplates = (mealLibrarySnap.data().meals || []).map((m: MealTemplate) => ({ ...m, createdAt: m.createdAt || Date.now() })).sort((a: MealTemplate, b: MealTemplate) => a.createdAt - b.createdAt);
      } else {
        currentTemplates = DEFAULT_INITIAL_MEALS.map(m => ({ ...m, id: m.id || generateId(), name: m.name, ingredients: m.ingredients || [], createdAt: m.createdAt || Date.now() }));
        await setDoc(mealLibraryRef, { meals: currentTemplates });
      }
      setAllMealTemplates(currentTemplates);

      // Load Daily Plans for the current week
      const plansToFetchKeys = weekDates.map(date => formatDateKey(date));
      const fetchedPlans: { [dateKey: string]: DayPlan } = {};
      const plansCollectionRef = collection(db, `userDailyPlans/${currentUser.uid}/plans`);
      
      if (plansToFetchKeys.length > 0) {
        const q = query(plansCollectionRef, where(documentId(), "in", plansToFetchKeys));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
            fetchedPlans[docSnap.id] = { ...docSnap.data(), date: docSnap.id } as DayPlan;
        });
      }

      plansToFetchKeys.forEach(dateKey => {
        if (!fetchedPlans[dateKey]) {
          fetchedPlans[dateKey] = { date: dateKey, mealAssignments: [] };
        }
      });
      setDailyPlansData(fetchedPlans);

      // Collect all instance IDs from fetched plans and load them
      const allInstanceIds = new Set<string>();
      Object.values(fetchedPlans).forEach(plan => {
        plan.mealAssignments.forEach(assignment => allInstanceIds.add(assignment.instanceId));
      });

      const uniqueInstanceIds = Array.from(allInstanceIds);
      const fetchedInstances: { [instanceId: string]: MealInstance } = {};
      if (uniqueInstanceIds.length > 0) {
        const instancesRef = collection(db, `userMealInstances/${currentUser.uid}/instances`);
        // Firestore 'in' query supports up to 30 elements. Batch if necessary.
        const MAX_IN_QUERY_ARGS = 30; // Firestore limit for "in" queries
        for (let i = 0; i < uniqueInstanceIds.length; i += MAX_IN_QUERY_ARGS) {
            const batchIds = uniqueInstanceIds.slice(i, i + MAX_IN_QUERY_ARGS);
            if (batchIds.length > 0) {
                const instanceQuery = query(instancesRef, where(documentId(), "in", batchIds));
                const instanceSnapshots = await getDocs(instanceQuery);
                instanceSnapshots.forEach(docSnap => {
                    fetchedInstances[docSnap.id] = { ...docSnap.data(), id: docSnap.id } as MealInstance;
                });
            }
        }
      }
      setLoadedMealInstances(fetchedInstances);
      setSuccessMessage("Data synced successfully!");

    } catch (e: any) {
      console.error("Firestore load error:", e);
      setError("Could not load cloud data. Using local defaults. " + e.message);
      const defaultLib = DEFAULT_INITIAL_MEALS.map(m => ({ ...m, id: m.id || generateId(), name: m.name, ingredients: m.ingredients || [], createdAt: m.createdAt || Date.now() }));
      setAllMealTemplates(defaultLib);
      const defaultPlans: { [dateKey: string]: DayPlan } = {};
      weekDates.map(formatDateKey).forEach(dateKey => {
          defaultPlans[dateKey] = { date: dateKey, mealAssignments: [] };
      });
      setDailyPlansData(defaultPlans);
      setLoadedMealInstances({});
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced save for meal templates
  useEffect(() => {
    if (isLoading || !user || !allMealTemplates.length) return;
    const debounceSave = setTimeout(async () => {
      setIsSaving(true);
      const mealLibraryRef = doc(db, "mealLibraries", user.uid);
      try {
        const cleanTemplates = allMealTemplates.map(t => ({
            ...t,
            ingredients: t.ingredients.map(({ isNew, isRemoving, ...ing }) => ing)
        }));
        await setDoc(mealLibraryRef, { meals: cleanTemplates }, { merge: true });
        setSuccessMessage("Meal library saved.");
      } catch (e: any) {
        console.error("Error saving meal library:", e);
        setError("Failed to save meal library.");
      } finally {
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(debounceSave);
  }, [allMealTemplates, user, isLoading]);

  const saveMealInstance = async (instance: MealInstance, showSuccess: boolean = true) => {
    if (!user) {
        setError("You must be signed in to save meal details.");
        return false;
    }
    setIsSaving(true);
    try {
        const instanceRef = doc(db, `userMealInstances/${user.uid}/instances`, instance.id);
        const cleanInstance = { ...instance, ingredients: instance.ingredients.map(({ isNew, isRemoving, ...ing }) => ing) };
        await setDoc(instanceRef, cleanInstance);
        setLoadedMealInstances(prev => ({...prev, [instance.id]: cleanInstance}));
        if (showSuccess) setSuccessMessage(`Meal "${instance.name}" details saved.`);
        return true;
    } catch (e: any) {
        console.error(`Error saving meal instance ${instance.id}:`, e);
        setError(`Failed to save meal "${instance.name}".`);
        return false;
    } finally {
        setIsSaving(false);
    }
  };
  
  const saveDailyPlan = async (dateKey: string, plan: DayPlan) => {
    if (!user) {
      setError("You must be signed in to save plans.");
      return;
    }
    setIsSaving(true);
    try {
      const planRef = doc(db, `userDailyPlans/${user.uid}/plans`, dateKey);
      // Ensure mealAssignments only stores instanceId and mealName
      const cleanAssignments = plan.mealAssignments.map(ma => ({ instanceId: ma.instanceId, mealName: ma.mealName }));
      await setDoc(planRef, { ...plan, mealAssignments: cleanAssignments });
      setSuccessMessage(`Plan for ${dateKey} saved.`);
    } catch (e: any) {
      console.error(`Error saving plan for ${dateKey}:`, e);
      setError(`Failed to save plan for ${dateKey}.`);
    } finally {
      setIsSaving(false);
    }
  };


  // --- Meal Template (Library) Handlers ---
  const handleOpenCreateMealTemplate = () => {
    setEditingTemplate({
      id: generateId(),
      name: `New Meal Template ${allMealTemplates.length + 1}`,
      ingredients: [],
      createdAt: Date.now(),
    });
    setIsMealLibraryModalOpen(false); // Close library to open editor
  };

  const handleSaveMealTemplate = (templateToSave: MealTemplate) => {
    const exists = allMealTemplates.some(t => t.id === templateToSave.id);
    let updatedTemplates;
    if (exists) {
      updatedTemplates = allMealTemplates.map(t => t.id === templateToSave.id ? { ...templateToSave, createdAt: templateToSave.createdAt || Date.now() } : t);
    } else {
      updatedTemplates = [...allMealTemplates, { ...templateToSave, createdAt: templateToSave.createdAt || Date.now() }];
    }
    setAllMealTemplates(updatedTemplates.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0) ));
    
    // Update mealName in dailyPlansData if a template name changed (for assignments originating from this template)
    // This is complex if instances can detach. For now, only update if templateId matches.
    const newDailyPlans = { ...dailyPlansData };
    Object.keys(newDailyPlans).forEach(dateKey => {
        newDailyPlans[dateKey].mealAssignments = newDailyPlans[dateKey].mealAssignments.map(ma => {
            const instance = loadedMealInstances[ma.instanceId];
            if (instance && instance.templateId === templateToSave.id && instance.name !== templateToSave.name) {
                // If instance name matches old template name, update it to new template name.
                // This assumes user hasn't customized the instance name separately.
                // A more robust solution would be to prompt user or handle customized names.
                // For simplicity, if an instance was from this template, its name gets updated unless user changes it manually later.
                const oldTemplateName = allMealTemplates.find(t => t.id === templateToSave.id)?.name;
                if (instance.name === oldTemplateName) {
                     // Update the instance itself
                    const updatedInstance = { ...instance, name: templateToSave.name };
                    saveMealInstance(updatedInstance, false); // save without separate success message
                    return { ...ma, mealName: templateToSave.name };
                }
            }
            return ma;
        });
    });
    setDailyPlansData(newDailyPlans);


    setEditingTemplate(null);
    setSuccessMessage(`Meal template "${templateToSave.name}" saved.`);
  };

  const handleRemoveMealTemplate = async (templateId: string) => {
    if (window.confirm("Are you sure you want to delete this meal template? This will NOT remove meals already planned on your days that were based on this template, but they will lose their link to it.")) {
      setAllMealTemplates(prev => prev.filter(t => t.id !== templateId));
      
      // Optionally, update instances that were linked to this template to remove templateId
      const updatedInstances: MealInstance[] = [];
      Object.values(loadedMealInstances).forEach(instance => {
        if (instance.templateId === templateId) {
          const modifiedInstance = { ...instance, templateId: undefined };
          updatedInstances.push(modifiedInstance);
        }
      });

      if (updatedInstances.length > 0 && user) {
        const batch = writeBatch(db);
        updatedInstances.forEach(inst => {
            const instRef = doc(db, `userMealInstances/${user.uid}/instances`, inst.id);
            batch.update(instRef, { templateId: undefined }); // Or delete templateId field
        });
        await batch.commit();
        setLoadedMealInstances(prev => {
            const newLoaded = {...prev};
            updatedInstances.forEach(ui => newLoaded[ui.id] = ui);
            return newLoaded;
        });
      }
      setSuccessMessage("Meal template deleted.");
    }
  };

  // --- Daily Plan & Meal Instance Handlers ---
  const handleOpenQuickAddMeal = (dateKey: string) => {
    setCreatingInstanceForDate(dateKey);
    setEditingInstance({
      id: generateId(),
      name: "New Quick Meal",
      ingredients: [],
      createdAt: Date.now(),
    });
    setExpandedDayKey(null); // Close expanded day to open meal editor
  };

  const handleEditMealInstance = (instanceId: string, dateKey: string) => {
    const instance = loadedMealInstances[instanceId];
    if (instance) {
      setEditingInstance({ ...instance });
      setCreatingInstanceForDate(dateKey); // To know which day it belongs to if saved
      setExpandedDayKey(null); // Close expanded day
    }
  };

  const handleSaveCurrentMealInstance = async (instanceToSave: MealInstance) => {
    const savedSuccessfully = await saveMealInstance(instanceToSave);
    if (savedSuccessfully && creatingInstanceForDate) {
        // If it's a new instance being added to a day
        if (!dailyPlansData[creatingInstanceForDate]?.mealAssignments.some(ma => ma.instanceId === instanceToSave.id)) {
            const newAssignment: MealAssignment = { instanceId: instanceToSave.id, mealName: instanceToSave.name };
            const updatedPlan: DayPlan = {
                ...(dailyPlansData[creatingInstanceForDate] || { date: creatingInstanceForDate, mealAssignments: [] }),
                mealAssignments: [...(dailyPlansData[creatingInstanceForDate]?.mealAssignments || []), newAssignment],
            };
            setDailyPlansData(prev => ({ ...prev, [creatingInstanceForDate]: updatedPlan }));
            saveDailyPlan(creatingInstanceForDate, updatedPlan);
        } else { // If it's an existing instance being edited, ensure mealName is up-to-date in DayPlan
            const plan = dailyPlansData[creatingInstanceForDate];
            if (plan) {
                const updatedAssignments = plan.mealAssignments.map(ma => 
                    ma.instanceId === instanceToSave.id ? { ...ma, mealName: instanceToSave.name } : ma
                );
                if (JSON.stringify(updatedAssignments) !== JSON.stringify(plan.mealAssignments)) {
                    const updatedPlan = { ...plan, mealAssignments: updatedAssignments };
                    setDailyPlansData(prev => ({ ...prev, [creatingInstanceForDate]: updatedPlan }));
                    saveDailyPlan(creatingInstanceForDate, updatedPlan);
                }
            }
        }
    }
    setEditingInstance(null);
    setCreatingInstanceForDate(null);
  };

  const handleSaveInstanceAsTemplate = (instance: MealInstance) => {
    if (!instance) return;
    const newTemplate: MealTemplate = {
        id: generateId(), // New ID for the template
        name: instance.name + " (template)",
        ingredients: JSON.parse(JSON.stringify(instance.ingredients)), // Deep copy
        createdAt: Date.now(),
    };
    handleSaveMealTemplate(newTemplate); // Uses existing template saving logic
    setSuccessMessage(`"${instance.name}" also saved as new template "${newTemplate.name}".`);
  };


  const handleAssignTemplateToDay = async (templateId: string, dateKey: string) => {
    const template = allMealTemplates.find(t => t.id === templateId);
    if (!template || !user) {
      setError("Meal template not found or user not signed in.");
      return;
    }
    const newInstance: MealInstance = {
      id: generateId(),
      templateId: template.id,
      name: template.name,
      ingredients: JSON.parse(JSON.stringify(template.ingredients)), // Deep copy ingredients
      createdAt: Date.now(),
    };

    const saved = await saveMealInstance(newInstance);
    if (!saved) return;

    const newAssignment: MealAssignment = { instanceId: newInstance.id, mealName: newInstance.name };
    const updatedPlan: DayPlan = {
      ...(dailyPlansData[dateKey] || { date: dateKey, mealAssignments: [] }),
      mealAssignments: [...(dailyPlansData[dateKey]?.mealAssignments || []), newAssignment],
    };
    setDailyPlansData(prev => ({ ...prev, [dateKey]: updatedPlan }));
    saveDailyPlan(dateKey, updatedPlan);
    setAssignTemplateToDate(null); // Close assign modal
    setExpandedDayKey(dateKey); // Re-open expanded day
  };


  const handleRemoveMealFromDay = async (instanceId: string, dateKey: string) => {
    const plan = dailyPlansData[dateKey];
    if (!plan) return;

    if (window.confirm("Are you sure you want to remove this meal from this day? The meal instance data will be deleted if not used elsewhere.")) {
        const updatedAssignments = plan.mealAssignments.filter(ma => ma.instanceId !== instanceId);
        const updatedPlan = { ...plan, mealAssignments: updatedAssignments };
        setDailyPlansData(prev => ({ ...prev, [dateKey]: updatedPlan }));
        saveDailyPlan(dateKey, updatedPlan);

        // Check if this instance is used in any other DayPlan
        let isInstanceUsedElsewhere = false;
        for (const key in dailyPlansData) {
            if (key !== dateKey && dailyPlansData[key].mealAssignments.some(ma => ma.instanceId === instanceId)) {
                isInstanceUsedElsewhere = true;
                break;
            }
        }

        if (!isInstanceUsedElsewhere && user) {
            try {
                const instanceRef = doc(db, `userMealInstances/${user.uid}/instances`, instanceId);
                await deleteDoc(instanceRef);
                setLoadedMealInstances(prev => {
                    const newLoaded = {...prev};
                    delete newLoaded[instanceId];
                    return newLoaded;
                });
                setSuccessMessage("Meal removed from day and instance data deleted.");
            } catch (e) {
                console.error("Error deleting meal instance:", e);
                setError("Meal removed from day, but failed to delete instance data.");
            }
        } else {
            setSuccessMessage("Meal removed from day.");
        }
    }
  };


  // --- Week Navigation & Data Fetching for New Weeks ---
  const goToPreviousWeek = () => setCurrentDisplayDate(prev => new Date(new Date(prev).setDate(prev.getDate() - 7)));
  const goToNextWeek = () => setCurrentDisplayDate(prev => new Date(new Date(prev).setDate(prev.getDate() + 7)));

  useEffect(() => {
    if (user && !isLoading) {
        const plansToFetchKeys = weekDates.map(date => formatDateKey(date));
        const newPlansToLoadKeys = plansToFetchKeys.filter(dateKey => !dailyPlansData[dateKey]);

        if (newPlansToLoadKeys.length > 0) {
            setIsLoading(true); // Indicate loading for new week's data
            const plansCollectionRef = collection(db, `userDailyPlans/${user.uid}/plans`);
            const q = query(plansCollectionRef, where(documentId(), "in", newPlansToLoadKeys));
            
            getDocs(q).then(async (querySnapshot) => {
                const fetchedPlansUpdate: { [dateKey: string]: DayPlan } = {};
                querySnapshot.forEach((docSnap) => {
                    fetchedPlansUpdate[docSnap.id] = { ...docSnap.data(), date: docSnap.id } as DayPlan;
                });
                newPlansToLoadKeys.forEach(dateKey => {
                    if (!fetchedPlansUpdate[dateKey]) { // Fill if not found in DB
                        fetchedPlansUpdate[dateKey] = { date: dateKey, mealAssignments: [] };
                    }
                });
                
                const newInstanceIdsToLoad = new Set<string>();
                Object.values(fetchedPlansUpdate).forEach(plan => {
                    plan.mealAssignments.forEach(assign => {
                        if(!loadedMealInstances[assign.instanceId]) { // Only fetch if not already loaded
                             newInstanceIdsToLoad.add(assign.instanceId);
                        }
                    });
                });

                const uniqueNewInstanceIds = Array.from(newInstanceIdsToLoad);
                const newFetchedInstances : { [instanceId: string]: MealInstance } = {};
                if (uniqueNewInstanceIds.length > 0) {
                    const instancesRef = collection(db, `userMealInstances/${user.uid}/instances`);
                    const MAX_IN_QUERY_ARGS = 30;
                    for (let i = 0; i < uniqueNewInstanceIds.length; i += MAX_IN_QUERY_ARGS) {
                        const batchIds = uniqueNewInstanceIds.slice(i, i + MAX_IN_QUERY_ARGS);
                        if (batchIds.length > 0) {
                            const instanceQuery = query(instancesRef, where(documentId(), "in", batchIds));
                            const instanceSnapshots = await getDocs(instanceQuery);
                            instanceSnapshots.forEach(docSnap => {
                                newFetchedInstances[docSnap.id] = { ...docSnap.data(), id: docSnap.id } as MealInstance;
                            });
                        }
                    }
                }
                setDailyPlansData(prev => ({ ...prev, ...fetchedPlansUpdate }));
                setLoadedMealInstances(prev => ({...prev, ...newFetchedInstances}));
                setIsLoading(false);
            }).catch(e => {
                console.error("Error fetching new week data:", e);
                setError("Failed to load plans for the selected week.");
                setIsLoading(false);
            });
        }
    }
  }, [weekDates, user, isLoading]); // Removed allMealTemplates from deps as instance names are in loadedMealInstances


  // --- Shopping List ---
  const generateShoppingList = useCallback(() => {
    const items: { [key: string]: ShoppingListItem } = {};
    weekDates.forEach(date => {
      const dateKey = formatDateKey(date);
      const plan = dailyPlansData[dateKey];
      if (plan) {
        plan.mealAssignments.forEach(assignment => {
          const mealInstance = loadedMealInstances[assignment.instanceId];
          if (mealInstance) {
            mealInstance.ingredients.forEach(ingredient => {
              const ingKey = (ingredient.name + (ingredient.source || '')).toLowerCase();
              const grams = parseFloat(String(ingredient.grams)) || 0;
              if (!items[ingKey]) {
                items[ingKey] = {
                  id: ingKey,
                  ingredientName: ingredient.name,
                  quantity: 0,
                  unit: 'g',
                  mealNames: [],
                  checked: false,
                  source: ingredient.source,
                };
              }
              items[ingKey].quantity += grams;
              if (!items[ingKey].mealNames.includes(mealInstance.name)) {
                items[ingKey].mealNames.push(mealInstance.name);
              }
            });
          }
        });
      }
    });
    setShoppingListItems(Object.values(items).sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)));
  }, [loadedMealInstances, dailyPlansData, weekDates]);

  useEffect(() => {
    if (isShoppingListModalOpen) generateShoppingList();
  }, [isShoppingListModalOpen, generateShoppingList]);
  
  const toggleShoppingListItem = (id: string) => setShoppingListItems(prev => prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item)));
  const clearCheckedShoppingListItems = () => setShoppingListItems(prev => prev.filter(item => !item.checked));
  const printShoppingList = () => { /* Same print logic */ 
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Shopping List</title><style>body{font-family:sans-serif;margin:20px}h1{text-align:center}ul{list-style-type:none;padding:0}li{margin-bottom:10px;padding:8px;border-bottom:1px solid #eee}.checked{text-decoration:line-through;color:#888}.quantity{font-style:italic;color:#555;margin-left:5px}.meals{font-size:0.9em;color:#777;margin-left:10px}</style></head>
        <body><h1>Shopping List</h1><ul>
        ${shoppingListItems.map(item => `<li class="${item.checked ? 'checked' : ''}"><strong>${item.ingredientName}</strong><span class="quantity">${round(item.quantity,1)}${item.unit}</span><span class="meals">(For: ${item.mealNames.join(', ')})</span></li>`).join('')}
        </ul><script>setTimeout(()=>{window.print();window.close();},250)</script></body></html>`);
      printWindow.document.close();
    } else {
        alert("Could not open print window. Please check pop-up settings.");
    }
  };

  // --- Calculate Daily Totals ---
  const calculateDailyTotals = (dateKey: string): NutrientTotals => {
    const plan = dailyPlansData[dateKey];
    let totals: NutrientTotals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    if (plan) {
      plan.mealAssignments.forEach(assignment => {
        const mealInstance = loadedMealInstances[assignment.instanceId];
        if (mealInstance) {
          mealInstance.ingredients.forEach(ing => {
            const grams = parseFloat(String(ing.grams)) || 0;
            totals.calories += (parseFloat(String(ing.calories100g)) || 0) / 100 * grams;
            totals.protein += (parseFloat(String(ing.protein100g)) || 0) / 100 * grams;
            totals.fat += (parseFloat(String(ing.fat100g)) || 0) / 100 * grams;
            totals.carbs += (parseFloat(String(ing.carbs100g)) || 0) / 100 * grams;
          });
        }
      });
    }
    return {
        calories: round(totals.calories), protein: round(totals.protein),
        fat: round(totals.fat), carbs: round(totals.carbs),
    };
  };

  // --- Message Timeout Effect ---
  useEffect(() => {
    let errorTimer: NodeJS.Timeout | undefined;
    let successTimer: NodeJS.Timeout | undefined;
    if (error) errorTimer = setTimeout(() => setError(null), 7000);
    if (successMessage) successTimer = setTimeout(() => setSuccessMessage(null), 7000);
    return () => { clearTimeout(errorTimer); clearTimeout(successTimer); };
  }, [error, successMessage]);

  // --- Logout ---
   const logOut = async () => {
    try {
      await signOut(auth);
      setSuccessMessage("You have been logged out successfully.");
      setAllMealTemplates(DEFAULT_INITIAL_MEALS.map(m => ({ ...m, createdAt: m.createdAt || Date.now() })));
      setDailyPlansData({});
      setLoadedMealInstances({});
      setCurrentDisplayDate(new Date());
      setExpandedDayKey(null);
    } catch (err) {
      console.error(err);
      setError("Failed to log out. Please try again.");
    }
  };

  if (isLoading && !user) {
     return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin h-16 w-16 text-teal-400 mb-6" />
        <div className="text-xl font-medium font-heading text-slate-300">Initializing Meal Planner...</div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 p-2 md:p-4 lg:p-6 selection:bg-teal-500 selection:text-white">
      <header className="mb-8 max-w-7xl mx-auto">
         {/* Auth and Title Section */}
         <div className="auth-container bg-slate-800/70 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border border-slate-700/50">
          {user ? (
            <>
              <div className="flex items-center">
                {user.photoURL ? <img src={user.photoURL} alt="User" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-3 border-2 border-teal-400 shadow-md object-cover" /> : <UserCircle className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-3 text-teal-400" />}
                <div>
                  <p className="text-sm sm:text-base font-semibold text-slate-100 font-heading truncate max-w-[150px] sm:max-w-xs">{user.displayName || "User"}</p>
                  <p className="text-xs sm:text-sm text-slate-400 truncate max-w-[150px] sm:max-w-xs">{user.email}</p>
                </div>
              </div>
              <button onClick={logOut} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm shadow-md hover:shadow-lg transition-all duration-150 flex items-center group">
                <LogOutIcon size={18} className="mr-2 group-hover:animate-pulse-gentle-hover" /> Log Out
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full text-center py-1">
              <p className="text-sm text-slate-300 mb-2">Sign in to save & sync your meal plans.</p>
              <Auth />
            </div>
          )}
        </div>
        <div className="text-center mb-6">
          <ChefHat size={50} className="text-teal-400 mb-2 mx-auto" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-heading">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-teal-400 to-sky-500">
              Weekly Meal Planner
            </span>
          </h1>
        </div>

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-[100] space-y-2 w-full max-w-xs sm:max-w-sm">
          {error && <div className="p-3 bg-red-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl flex items-center space-x-2 animate-slideInTopRight" role="alert"><AlertCircle size={20} /><span>{error}</span></div>}
          {successMessage && <div className="p-3 bg-green-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl flex items-center space-x-2 animate-slideInTopRight" role="status"><Check size={20} /><span>{successMessage}</span></div>}
          {isSaving && !isLoading && <div className="p-3 bg-sky-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl flex items-center space-x-2 animate-fadeIn" role="status"><Loader2 size={20} className="animate-spin" /><span>Saving...</span></div>}
        </div>
      </header>

      {isLoading && user && (
         <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
            <Loader2 className="animate-spin h-12 w-12 text-teal-400 mb-4" />
            <div className="text-lg font-medium font-heading text-slate-300">Loading week data...</div>
        </div>
      )}

      {!isLoading && (
        <main className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 px-1">
            <div className="flex items-center gap-2">
              <button onClick={goToPreviousWeek} className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 shadow transition-colors" aria-label="Previous week"><ChevronLeft size={22} /></button>
              <h2 className="text-xl sm:text-2xl font-semibold font-heading text-center text-slate-100 w-48 sm:w-64">
                {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <button onClick={goToNextWeek} className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 shadow transition-colors" aria-label="Next week"><ChevronRight size={22} /></button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => {setIsMealLibraryModalOpen(true); setExpandedDayKey(null);}} className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-5 rounded-lg shadow flex items-center justify-center"><BookOpen size={18} className="mr-2"/> Meal Library</button>
              <button onClick={() => setIsShoppingListModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-lg shadow flex items-center justify-center"><ShoppingCart size={18} className="mr-2"/> Shopping List</button>
            </div>
          </div>

          {/* Weekly Calendar Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
            {weekDates.map(date => {
              const dateKey = formatDateKey(date);
              const plan = dailyPlansData[dateKey] || { date: dateKey, mealAssignments: [] };
              const dailyTotals = calculateDailyTotals(dateKey);
              const isToday = formatDateKey(new Date()) === dateKey;
              const isExpanded = expandedDayKey === dateKey;

              return (
                <div key={dateKey} 
                     className={`day-card bg-slate-800/90 p-3 rounded-lg shadow-lg border ${isToday ? 'border-teal-500/70 ring-2 ring-teal-500/50' : 'border-slate-700/80'} flex flex-col transition-all duration-300 ease-out ${isExpanded ? 'col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-7 min-h-[400px] shadow-2xl ring-2 ring-sky-500/60' : 'min-h-[280px] hover:shadow-xl'}`}
                     onClick={() => setExpandedDayKey(isExpanded ? null : dateKey)}
                >
                  <div className={`flex justify-between items-center pb-2 mb-2 border-b ${isToday ? 'border-teal-600/50' : 'border-slate-700'}`}>
                    <h3 className={`font-semibold font-heading ${isToday ? 'text-teal-400' : 'text-slate-200'} ${isExpanded ? 'text-xl' : 'text-base'}`}>{getDayName(date, isExpanded ? 'long' : 'short')}</h3>
                    <span className={`text-xs ${isToday ? 'text-teal-300' : 'text-slate-400'} ${isExpanded ? 'text-sm' : 'text-xs'}`}>{date.getDate()} {isExpanded ? date.toLocaleDateString(undefined, {month: 'long'}) : ''}</span>
                  </div>
                  <div className={`text-slate-400 mb-3 space-y-1 ${isExpanded ? 'text-base grid grid-cols-2 gap-x-4 gap-y-1' : 'text-sm'}`}>
                      <div className={isExpanded ? 'font-medium' : ''}>C: <span className={`font-semibold ${isExpanded ? 'text-xl' : 'text-base'} text-slate-100`}>{dailyTotals.calories}</span> <span className={isExpanded ? 'text-slate-300' : 'text-slate-400'}>kcal</span></div>
                      <div className={isExpanded ? 'font-medium' : ''}>P: <span className={`font-semibold ${isExpanded ? 'text-xl' : 'text-base'} text-slate-100`}>{dailyTotals.protein}</span> <span className={isExpanded ? 'text-slate-300' : 'text-slate-400'}>g</span></div>
                      <div className={isExpanded ? 'font-medium' : ''}>F: <span className={`font-semibold ${isExpanded ? 'text-xl' : 'text-base'} text-slate-100`}>{dailyTotals.fat}</span> <span className={isExpanded ? 'text-slate-300' : 'text-slate-400'}>g</span></div>
                      <div className={isExpanded ? 'font-medium' : ''}>Cb: <span className={`font-semibold ${isExpanded ? 'text-xl' : 'text-base'} text-slate-100`}>{dailyTotals.carbs}</span> <span className={isExpanded ? 'text-slate-300' : 'text-slate-400'}>g</span></div>
                  </div>
                  
                  {/* Meal Assignments List */}
                  <div className={`meal-assignments-list flex-grow space-y-1.5 mb-2 overflow-y-auto max-h-[${isExpanded ? 'none' : '150px'}] custom-scrollbar pr-1`}>
                    {plan.mealAssignments.length === 0 && <p className={`text-xs text-slate-500 text-center py-4 ${isExpanded ? 'text-sm' : ''}`}>No meals planned.</p>}
                    {plan.mealAssignments.map(assignment => {
                       const mealInstance = loadedMealInstances[assignment.instanceId];
                       const instanceName = mealInstance ? mealInstance.name : assignment.mealName; // Fallback to stored name
                       const instanceIngredientsCount = mealInstance ? mealInstance.ingredients.length : 0;
                      return (
                        <div key={assignment.instanceId} className={`bg-slate-700/70 p-2 rounded text-xs flex justify-between items-center group hover:bg-slate-600/90 ${isExpanded ? 'py-2.5 px-3' : 'py-1.5 px-2'}`}>
                           <div>
                            <span className={`text-slate-100 truncate font-medium ${isExpanded ? 'text-sm' : ''}`} title={instanceName}>{instanceName}</span>
                            {isExpanded && mealInstance && <p className="text-slate-400 text-xs">{instanceIngredientsCount} ingredients</p>}
                          </div>
                          {isExpanded && (
                            <div className="flex items-center gap-1.5">
                                <button onClick={(e) => {e.stopPropagation(); handleEditMealInstance(assignment.instanceId, dateKey);}} className="p-1 text-slate-300 hover:text-teal-400" aria-label={`Edit ${instanceName}`}><Edit size={16}/></button>
                                <button onClick={(e) => {e.stopPropagation(); handleRemoveMealFromDay(assignment.instanceId, dateKey);}} className="p-1 text-slate-400 hover:text-red-400" aria-label={`Remove ${instanceName}`}><Trash2 size={16}/></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Buttons for expanded view */}
                  {isExpanded && (
                    <div className="mt-auto pt-3 border-t border-slate-700 flex flex-col sm:flex-row gap-2">
                        <button onClick={(e) => {e.stopPropagation(); handleOpenQuickAddMeal(dateKey);}} className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2 px-3 rounded-md w-full flex items-center justify-center"><PlusCircle size={16} className="mr-1.5"/> Add Quick Meal</button>
                        <button onClick={(e) => {e.stopPropagation(); setAssignTemplateToDate(dateKey); setExpandedDayKey(null);}} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-3 rounded-md w-full flex items-center justify-center"><BookOpen size={16} className="mr-1.5"/> Add from Library</button>
                    </div>
                  )}
                   {!isExpanded && (
                     <button onClick={(e) => {e.stopPropagation(); setExpandedDayKey(dateKey);}} className="mt-auto bg-teal-600/80 hover:bg-teal-600 text-white text-xs font-medium py-1.5 px-2 rounded-md w-full transition-colors opacity-80 hover:opacity-100">
                         <Eye size={14} className="inline mr-1"/> View/Edit Day
                     </button>
                   )}
                </div>
              );
            })}
          </div>
        </main>
      )}


      {/* Meal Library Modal */}
      {isMealLibraryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setIsMealLibraryModalOpen(false)}>
          <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
              <h2 className="text-2xl font-heading font-semibold text-purple-400 flex items-center"><BookOpen size={28} className="mr-3"/> Meal Library</h2>
              <button onClick={() => setIsMealLibraryModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close meal library"><X size={24} /></button>
            </div>
            <button onClick={handleOpenCreateMealTemplate} className="mb-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg shadow flex items-center justify-center w-full sm:w-auto self-start"><PlusCircle size={18} className="mr-2"/> Create New Meal Template</button>
            <div className="overflow-y-auto flex-grow space-y-2 pr-1 custom-scrollbar">
              {allMealTemplates.length === 0 && <p className="text-slate-400 text-center py-6">Your meal library is empty. Create some templates!</p>}
              {allMealTemplates.map(template => (
                <div key={template.id} className="bg-slate-700/80 p-3 rounded-lg flex justify-between items-center group">
                  <div>
                    <h4 className="font-semibold text-slate-100">{template.name}</h4>
                    <p className="text-xs text-slate-400">{template.ingredients.length} ingredients</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {setEditingTemplate(template); setIsMealLibraryModalOpen(false);}} className="p-2 text-slate-300 hover:text-teal-400" aria-label={`Edit ${template.name}`}><Edit size={18}/></button>
                    <button onClick={() => handleRemoveMealTemplate(template.id)} className="p-2 text-slate-300 hover:text-red-400" aria-label={`Delete ${template.name}`}><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Template to Day Modal */}
      {assignTemplateToDate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => {setAssignTemplateToDate(null); setExpandedDayKey(assignTemplateToDate);}}>
          <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
                <h2 className="text-xl font-heading font-semibold text-teal-400">Assign Template to {getDayName(new Date(assignTemplateToDate), 'long')} {new Date(assignTemplateToDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</h2>
                <button onClick={() => {setAssignTemplateToDate(null); setExpandedDayKey(assignTemplateToDate);}} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close assign meal"><X size={24} /></button>
            </div>
             <div className="overflow-y-auto flex-grow space-y-2 pr-1 custom-scrollbar">
                {allMealTemplates.length === 0 && <p className="text-slate-400">No meal templates in your library. Create one first!</p>}
                {allMealTemplates.map(template => (
                    <button key={template.id} onClick={() => handleAssignTemplateToDay(template.id, assignTemplateToDate)} className="w-full text-left bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors">
                        <h4 className="font-medium text-slate-100">{template.name}</h4>
                        <p className="text-xs text-slate-400">{template.ingredients.length} ingredients</p>
                    </button>
                ))}
             </div>
          </div>
        </div>
      )}
      
      {/* Edit/Create Meal Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] p-2 sm:p-4 overflow-y-auto animate-fadeIn" 
             aria-modal="true" role="dialog" aria-labelledby="meal-template-editor-title">
          <div className="max-w-4xl mx-auto my-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <h2 id="meal-template-editor-title" className="text-xl font-heading font-semibold text-teal-400">
                    {allMealTemplates.some(m => m.id === editingTemplate.id) ? 'Edit Meal Template' : 'Create New Meal Template'}
                </h2>
                <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close meal template editor">
                    <X size={24} />
                </button>
            </div>
            <MealComponent
              mealData={editingTemplate} // Pass as mealData
              editingMode="template"
              onUpdateMealData={(updatedData) => setEditingTemplate(prev => prev ? {...prev, ...updatedData} : null)}
              onSave={handleSaveMealTemplate}
              onClose={() => setEditingTemplate(null)}
            />
          </div>
        </div>
      )}

      {/* Edit/Create Meal Instance Modal (Quick Add / Edit from Day) */}
      {(editingInstance && creatingInstanceForDate) && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] p-2 sm:p-4 overflow-y-auto animate-fadeIn" 
             aria-modal="true" role="dialog" aria-labelledby="meal-instance-editor-title">
          <div className="max-w-4xl mx-auto my-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <h2 id="meal-instance-editor-title" className="text-xl font-heading font-semibold text-sky-400">
                    {loadedMealInstances[editingInstance.id] ? `Edit Meal for ${getDayName(new Date(creatingInstanceForDate), 'long')}` : `Add New Meal to ${getDayName(new Date(creatingInstanceForDate), 'long')}`}
                </h2>
                <button onClick={() => {setEditingInstance(null); setCreatingInstanceForDate(null); setExpandedDayKey(creatingInstanceForDate);}} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close meal editor">
                    <X size={24} />
                </button>
            </div>
            <MealComponent
              mealData={editingInstance} // Pass as mealData
              editingMode="instance"
              onUpdateMealData={(updatedData) => setEditingInstance(prev => prev ? {...prev, ...updatedData} : null)}
              onSave={handleSaveCurrentMealInstance}
              onSaveAsTemplate={handleSaveInstanceAsTemplate}
              onClose={() => {setEditingInstance(null); setCreatingInstanceForDate(null); setExpandedDayKey(creatingInstanceForDate);}}
            />
          </div>
        </div>
      )}


       {/* Shopping List Modal */}
       {isShoppingListModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn" onClick={() => setIsShoppingListModalOpen(false)}>
          <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-xl border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
              <h2 className="text-2xl font-heading font-semibold text-teal-400 flex items-center"><ShoppingCart size={28} className="mr-3"/> Shopping List (Current Week)</h2>
              <button onClick={() => setIsShoppingListModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1"><X size={24} /></button>
            </div>
            {shoppingListItems.length === 0 ? (
              <div className="text-center py-10 text-slate-400"><ListChecks size={40} className="mx-auto mb-3 text-slate-500" /><p>Shopping list is empty for this week.</p></div>
            ) : (
              <>
                <div className="overflow-y-auto flex-grow mb-4 pr-2 custom-scrollbar space-y-2.5">
                  {shoppingListItems.map(item => (
                    <div key={item.id} className={`flex items-center p-3 rounded-lg transition-all ${item.checked ? 'bg-slate-700/60 border-slate-600/50 opacity-70' : 'bg-slate-700/90 hover:bg-slate-600/80 border-slate-600'}`}>
                      <input type="checkbox" checked={item.checked} onChange={() => toggleShoppingListItem(item.id)} id={`sl-${item.id}`} className="h-5 w-5 rounded bg-slate-500 border-slate-400 text-teal-500 focus:ring-teal-500 accent-teal-500 cursor-pointer mr-3.5" />
                      <label htmlFor={`sl-${item.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-start">
                          <span className={`font-medium ${item.checked ? 'line-through text-slate-400' : 'text-slate-100'}`}>{item.ingredientName}</span>
                          <span className={`text-sm font-semibold ml-2 ${item.checked ? 'text-slate-500' : 'text-teal-300'}`}>{round(item.quantity,1)}{item.unit}</span>
                        </div>
                        <div className={`text-xs mt-0.5 ${item.checked ? 'text-slate-500' : 'text-slate-400'}`} title={`For: ${item.mealNames.join(', ')}`}>
                          Meals: {item.mealNames.join(', ').length > 50 ? item.mealNames.join(', ').substring(0,47)+'...' : item.mealNames.join(', ')}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-700">
                  <button onClick={clearCheckedShoppingListItems} disabled={!shoppingListItems.some(i => i.checked)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg shadow w-full sm:w-auto disabled:opacity-50"><Trash2 size={16} className="mr-2 inline"/> Clear Checked</button>
                  <button onClick={printShoppingList} disabled={shoppingListItems.length === 0} className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-5 rounded-lg shadow w-full sm:w-auto disabled:opacity-50"><Printer size={16} className="mr-2 inline"/> Print List</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      <footer className="text-center text-slate-500 mt-16 py-6 border-t border-slate-700/50 text-sm">
          <p>&copy; {new Date().getFullYear()} Weekly Meal Planner.
            {user ? ` All changes are synced.` : ` Sign in to save progress.`}
          </p>
      </footer>
    </div>
  );
}

export default App;

