// App.tsx - FINAL CLEANED-UP VERSION

// Firebase and Auth imports
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from "firebase/firestore";

// React and Type imports
import { useState, useEffect, useCallback } from 'react';
import { Meal, Ingredient } from './types';
import { generateId, DEFAULT_INITIAL_MEALS } from './constants';
import MealComponent from './components/MealComponent';
import { ChefHat, PlusCircle, Loader2, AlertCircle, Check } from './components/icons';
import { Auth } from "./Auth";

// --- App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Authentication Logic ---
  const logOut = async () => {
    try {
      await signOut(auth);
      // When user becomes null, the data loading logic will handle resetting the meals
      setSuccessMessage("You have been logged out.");
    } catch (err) {
      console.error(err);
      setError("Failed to log out.");
    }
  };

  // --- Data Loading and Saving Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      loadDataForUser(currentUser); 
    });
    return () => unsubscribe();
  }, []);

  const loadDataForUser = async (currentUser: User | null) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (currentUser) {
      // USER IS LOGGED IN: Use Firestore
      try {
        setSuccessMessage("Syncing data from your account...");
        const userDocRef = doc(db, "meals", currentUser.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          setMeals(cloudData.meals || []);
          setSuccessMessage("Data synced successfully!");
        } else {
          setMeals(DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: Date.now() })));
          setSuccessMessage("Welcome! Your meal plan is ready. Changes will be saved to your account.");
        }
      } catch (e: any) {
        console.error("Firestore load error:", e);
        setError("Could not load cloud data.");
        setMeals(DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: Date.now() })));
      }
    } else {
      // USER IS LOGGED OUT: Use default meals
      setMeals(DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: Date.now() })));
      setSuccessMessage("Started with default meals. Sign in to sync across devices.");
    }
    setIsLoading(false);
  };

  const saveData = async (mealsToSave: Meal[]) => {
    if (user) {
      try {
        const userDocRef = doc(db, "meals", user.uid);
        await setDoc(userDocRef, { meals: mealsToSave });
      } catch (e: any) {
        console.error("Firestore save error:", e);
        setError("Failed to save data to cloud.");
      }
    }
    // No "else" needed, as there's no saving for logged-out users anymore
  };

  // Auto-save effect
  useEffect(() => {
    if (isLoading || !user) return; // Only save if loading is done AND a user is logged in

    const debounceSave = setTimeout(() => {
        saveData(meals);
    }, 1000);

    return () => clearTimeout(debounceSave);
  }, [meals, user, isLoading]);

  // --- Meal Manipulation Handlers (These are still needed) ---
  const handleAddMeal = useCallback((mealToDuplicate: Meal | null = null) => { let newMeal: Meal; if (mealToDuplicate) { newMeal = { ...mealToDuplicate, id: generateId(), name: `${mealToDuplicate.name} (Copy)`, ingredients: mealToDuplicate.ingredients.map((ing: Ingredient) => ({ ...ing, id: generateId() })), createdAt: Date.now() }; } else { newMeal = { id: generateId(), name: `Meal ${meals.length + 1}`, ingredients: [], createdAt: Date.now() }; } setMeals(prevMeals => [...prevMeals, newMeal].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); }, [meals.length]);
  const handleRemoveMeal = useCallback((mealId: string) => { setMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealId)); }, []);
  const handleUpdateMealName = useCallback((mealId: string, newName: string) => { setMeals(prevMeals => prevMeals.map(meal => meal.id === mealId ? { ...meal, name: newName } : meal).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); }, []);
  const handleAddIngredient = useCallback((mealId: string, ingredientData?: Partial<Ingredient>) => { const newIngredient: Ingredient = { id: generateId(), name: '', calories100g: 0, protein100g: 0, fat100g: 0, carbs100g: 0, grams: 0, ...ingredientData, }; setMeals(prevMeals => prevMeals.map(meal => meal.id === mealId ? { ...meal, ingredients: [...meal.ingredients, newIngredient] } : meal).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); }, []);
  const handleRemoveIngredient = useCallback((mealId: string, ingredientId: string) => { setMeals(prevMeals => prevMeals.map(meal => meal.id === mealId ? { ...meal, ingredients: meal.ingredients.filter(ing => ing.id !== ingredientId) } : meal).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); }, []);
  const handleUpdateIngredient = useCallback((mealId: string, ingredientId: string, updatedValues: Partial<Ingredient>) => { setMeals(prevMeals => prevMeals.map(meal => meal.id === mealId ? { ...meal, ingredients: meal.ingredients.map(ing => ing.id === ingredientId ? { ...ing, ...updatedValues } : ing ) } : meal).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); }, []);

  // --- Message Timeout Effect ---
  useEffect(() => {
    if (error) { const timer = setTimeout(() => setError(null), 7000); return () => clearTimeout(timer); }
    if (successMessage) { const timer = setTimeout(() => setSuccessMessage(null), 5000); return () => clearTimeout(timer); }
  }, [error, successMessage]);

  if (isLoading) {
     return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <Loader2 className="animate-spin mr-2 h-8 w-8 text-sky-400" />
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // --- Render JSX ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-6">
        <div className="auth-container bg-slate-800/50 p-2 rounded-lg mb-4 flex items-center justify-between">
          {user ? (
            <>
              <div className="flex items-center">
                {user.photoURL && <img src={user.photoURL} alt="User profile" className="w-10 h-10 rounded-full mr-3 border-2 border-sky-400" />}
                <div>
                  <p className="text-sm font-semibold text-slate-300">Welcome, {user.displayName}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              </div>
              <button onClick={logOut} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm">Log Out</button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full">
              <p className="text-sm text-slate-400 mb-2">Sign in to sync your meal plan across devices.</p>
              <Auth />
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center mb-1">
          <ChefHat size={48} className="text-sky-400 mr-3" />
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Shiv's Meal Planner V2</h1>
        </div>
        <p className="text-sm text-slate-400 text-center mb-3">Your personal meal planning assistant.</p>
        
        {error && (<div className="mt-4 p-3 bg-red-800/50 border border-red-700 rounded-md text-red-300 flex items-center justify-center max-w-lg mx-auto text-sm" role="alert"><AlertCircle size={20} className="mr-2 flex-shrink-0" /><span>{error}</span></div>)}
        {successMessage && (<div className="mt-4 p-3 bg-green-800/50 border border-green-700 rounded-md text-green-300 flex items-center justify-center max-w-lg mx-auto text-sm" role="status"><Check size={20} className="mr-2 flex-shrink-0" /><span>{successMessage}</span></div>)}
      </header>
      
      {meals.map(meal => (
        <MealComponent key={meal.id} meal={meal} onDuplicateMeal={() => handleAddMeal(meal)} onRemoveMeal={handleRemoveMeal} onUpdateMealName={handleUpdateMealName} onAddIngredient={handleAddIngredient} onRemoveIngredient={handleRemoveIngredient} onUpdateIngredient={handleUpdateIngredient}/>
      ))}

      <div className="mt-8 flex justify-center">
        <button onClick={() => handleAddMeal()} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center text-lg">
          <PlusCircle size={24} className="mr-2" /> Add New Meal
        </button>
      </div>

      <footer className="text-center text-slate-500 mt-12 py-4 border-t border-slate-700 text-sm">
          <p>© {new Date().getFullYear()} Shiv's Meal Planner. 
            {user ? ` Data is synced to your account.` : ` Sign in to save and sync.`}
          </p>
      </footer>
    </div>
  );
}

export default App;