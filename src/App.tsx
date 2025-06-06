// App.tsx - AI Feature Removed, Shopping List Added

// Firebase and Auth imports
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from "firebase/firestore";

// React and Type imports
import { useState, useEffect, useCallback } from 'react'; // Removed React, useRef
import { Meal, Ingredient, ShoppingListItem } from './types'; // Removed UsdaFoodItem, OpenFoodFactsItem, AI Types, Added ShoppingListItem
import { generateId, DEFAULT_INITIAL_MEALS, round } from './constants';
import MealComponent from './components/MealComponent';
import { ChefHat, PlusCircle, Loader2, AlertCircle, Check, LogOut as LogOutIcon, UserCircle, X, Search, ShoppingCart, ListChecks, Printer, Trash2 } from './components/icons';
import { Auth } from "./Auth";


// --- App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Shopping List State
  const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);


  // --- Authentication Logic ---
  const logOut = async () => {
    try {
      await signOut(auth);
      setSuccessMessage("You have been logged out successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to log out. Please try again.");
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
      try {
        setSuccessMessage("Syncing data from your account...");
        const userDocRef = doc(db, "meals", currentUser.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          const loadedMeals = (cloudData.meals || []).map((m: Meal) => ({
            ...m,
            createdAt: m.createdAt || Date.now(),
            ingredients: (m.ingredients || []).map(ing => ({ ...ing, isNew: false, isRemoving: false }))
          })).sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0));
          setMeals(loadedMeals);
          setSuccessMessage("Data synced successfully!");
        } else {
          const defaultMeals = DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: m.createdAt || Date.now(), ingredients: m.ingredients.map(ing => ({ ...ing, isNew: false, isRemoving: false })) })).sort((a: Meal,b: Meal) => (a.createdAt || 0) - (b.createdAt || 0));
          setMeals(defaultMeals);
          await saveData(defaultMeals, currentUser);
          setSuccessMessage("Welcome! Your meal plan is ready. Changes will be saved to your account.");
        }
      } catch (e: any) {
        console.error("Firestore load error:", e);
        setError("Could not load cloud data. Using default meals.");
        const defaultMeals = DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: m.createdAt || Date.now(), ingredients: m.ingredients.map(ing => ({ ...ing, isNew: false, isRemoving: false })) })).sort((a: Meal,b: Meal) => (a.createdAt || 0) - (b.createdAt || 0));
        setMeals(defaultMeals);
      }
    } else {
      const defaultMeals = DEFAULT_INITIAL_MEALS.map((m: Meal) => ({ ...m, createdAt: m.createdAt || Date.now(), ingredients: m.ingredients.map(ing => ({ ...ing, isNew: false, isRemoving: false })) })).sort((a: Meal,b: Meal) => (a.createdAt || 0) - (b.createdAt || 0));
      setMeals(defaultMeals);
      setSuccessMessage("Started with default meals. Sign in to sync across devices and save your progress.");
    }
    setIsLoading(false);
  };

  const saveData = async (mealsToSave: Meal[], targetUser: User | null = user) => {
    if (targetUser) {
      try {
        const cleanMealsToSave = mealsToSave.map(m => ({
          ...m,
          ingredients: m.ingredients.map(({ isNew, isRemoving, ...ing }) => ing)
        }));
        const userDocRef = doc(db, "meals", targetUser.uid);
        await setDoc(userDocRef, { meals: cleanMealsToSave });
      } catch (e: any) {
        console.error("Firestore save error:", e);
        setError("Failed to save data to cloud. Please check your connection.");
      }
    }
  };

  useEffect(() => {
    if (isLoading || !user) return;
    const mealsWithoutRemoving = meals.filter(m =>
        m.ingredients.every(ing => !ing.isRemoving)
    );
    if (mealsWithoutRemoving.length < meals.length) return;

    const debounceSave = setTimeout(() => { saveData(mealsWithoutRemoving); }, 1500);
    return () => clearTimeout(debounceSave);
  }, [meals, user, isLoading]);


  // --- Meal Manipulation Handlers ---
  const handleAddMeal = useCallback((mealToAddAsIs?: Meal, mealToDuplicate?: Meal | null) => {
    let newMeal: Meal;
    if (mealToAddAsIs) {
        newMeal = { ...mealToAddAsIs, createdAt: mealToAddAsIs.createdAt || Date.now() };
    } else if (mealToDuplicate) {
      newMeal = {
        ...mealToDuplicate,
        id: generateId(),
        name: `${mealToDuplicate.name} (Copy)`,
        ingredients: mealToDuplicate.ingredients.map((ing: Ingredient) => ({ ...ing, id: generateId(), isNew: false, isRemoving: false })),
        createdAt: Date.now()
      };
    } else {
      newMeal = {
        id: generateId(),
        name: `New Meal ${meals.length + 1}`,
        ingredients: [],
        createdAt: Date.now()
      };
    }
    setMeals(prevMeals => [...prevMeals, newMeal].sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0)));
    if (!mealToAddAsIs) setSuccessMessage("New meal added!");
  }, [meals.length]);

  const handleRemoveMeal = useCallback((mealId: string) => {
    setMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealId));
    setError("Meal removed.");
  }, []);

  const handleUpdateMealName = useCallback((mealId: string, newName: string) => {
    setMeals(prevMeals => prevMeals.map(meal => meal.id === mealId ? { ...meal, name: newName } : meal).sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0)));
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
      isNew: true,
      isRemoving: false,
    };
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId
          ? { ...meal, ingredients: [...meal.ingredients, newIngredient] }
          : meal
      ).sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0))
    );
    setTimeout(() => {
        setMeals(prev => prev.map(m => m.id === mealId ? {
            ...m,
            ingredients: m.ingredients.map(ing => ing.id === newIngredient.id ? {...ing, isNew: false} : ing)
        } : m))
    }, 500);
  }, []);

  const handleRemoveIngredient = useCallback((mealId: string, ingredientId: string) => {
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId
          ? {
              ...meal,
              ingredients: meal.ingredients.map(ing =>
                ing.id === ingredientId ? { ...ing, isRemoving: true } : ing
              ),
            }
          : meal
      )
    );
    setTimeout(() => {
      setMeals(prevMeals =>
        prevMeals.map(meal =>
          meal.id === mealId
            ? { ...meal, ingredients: meal.ingredients.filter(ing => ing.id !== ingredientId) }
            : meal
        ).sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0))
      );
    }, 500);
  }, []);

  const handleUpdateIngredient = useCallback((mealId: string, ingredientId: string, updatedValues: Partial<Ingredient>) => {
    setMeals(prevMeals =>
      prevMeals.map(meal =>
        meal.id === mealId
          ? {
              ...meal,
              ingredients: meal.ingredients.map(ing =>
                ing.id === ingredientId ? { ...ing, ...updatedValues } : ing
              ),
            }
          : meal
      ).sort((a: Meal, b: Meal) => (a.createdAt || 0) - (b.createdAt || 0))
    );
  }, []);

  // --- Shopping List Logic ---
  const generateShoppingList = useCallback(() => {
    const items: { [key: string]: { quantity: number; meals: string[]; source?: Ingredient['source'] } } = {};

    meals.forEach(meal => {
      meal.ingredients.forEach(ingredient => {
        const ingName = ingredient.name.trim().toLowerCase();
        if (ingName) {
          const grams = parseFloat(String(ingredient.grams)) || 0;
          if (!items[ingName]) {
            items[ingName] = { quantity: 0, meals: [], source: ingredient.source };
          }
          items[ingName].quantity += grams;
          if (!items[ingName].meals.includes(meal.name)) {
            items[ingName].meals.push(meal.name);
          }
          if (ingredient.source && !items[ingName].source) {
             items[ingName].source = ingredient.source;
          }
        }
      });
    });

    const sortedList: ShoppingListItem[] = Object.entries(items)
      .map(([name, data]) => ({
        id: generateId(),
        ingredientName: name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
        quantity: data.quantity > 0 ? `${round(data.quantity, 1)}g` : 'As needed',
        mealNames: data.meals.join(', '),
        checked: false,
        source: data.source
      }))
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

    setShoppingListItems(sortedList);
  }, [meals]);

  useEffect(() => {
    if (isShoppingListModalOpen) {
      generateShoppingList();
    }
  }, [isShoppingListModalOpen, meals, generateShoppingList]);

  const toggleShoppingListItem = (id: string) => {
    setShoppingListItems(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const clearCheckedShoppingListItems = () => {
    setShoppingListItems(prev => prev.filter(item => !item.checked));
  };

  const printShoppingList = () => {
    // const printableContent = shoppingListItems.map(item => // This variable was unused
    //   `${item.checked ? '[x]' : '[ ]'} ${item.ingredientName} - ${item.quantity} (For: ${item.mealNames})`
    // ).join('\n');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Shopping List - Shiv's Meal Planner</title>
            <style>
              body { font-family: sans-serif; margin: 20px; }
              h1 { text-align: center; color: #333; }
              ul { list-style-type: none; padding: 0; }
              li { margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee; }
              li.checked { text-decoration: line-through; color: #888; }
              .quantity { font-style: italic; color: #555; }
              .meals { font-size: 0.9em; color: #777; margin-left: 10px;}
            </style>
          </head>
          <body>
            <h1>Shopping List</h1>
            <ul>
              ${shoppingListItems.map(item => `
                <li class="${item.checked ? 'checked' : ''}">
                  <strong>${item.ingredientName}</strong>
                  <span class="quantity">${item.quantity}</span>
                  <span class="meals">(For: ${item.mealNames})</span>
                </li>
              `).join('')}
            </ul>
            <script>
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert("Could not open print window. Please check your browser's pop-up settings.");
    }
  };


  // --- Message Timeout Effect ---
  useEffect(() => {
    let errorTimer: NodeJS.Timeout | undefined;
    let successTimer: NodeJS.Timeout | undefined;
    if (error) { errorTimer = setTimeout(() => setError(null), 7000); }
    if (successMessage) { successTimer = setTimeout(() => setSuccessMessage(null), 7000); }
    return () => {
      clearTimeout(errorTimer);
      clearTimeout(successTimer);
    };
  }, [error, successMessage]);

  if (isLoading) {
     return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin h-16 w-16 text-teal-400 mb-6" />
        <div className="text-xl font-medium font-heading text-slate-300">Loading your meal plans...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 selection:bg-teal-500 selection:text-white">
      <header className="mb-10 max-w-6xl mx-auto">
        <div className="auth-container bg-slate-800/70 backdrop-blur-md p-3.5 sm:p-4 rounded-xl shadow-lg mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border border-slate-700/50">
          {user ? (
            <>
              <div className="flex items-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User profile" className="w-11 h-11 sm:w-12 sm:h-12 rounded-full mr-3.5 border-2 border-teal-400 shadow-md object-cover" />
                ) : (
                  <UserCircle className="w-11 h-11 sm:w-12 sm:h-12 rounded-full mr-3.5 text-teal-400" />
                )}
                <div>
                  <p className="text-sm sm:text-base font-semibold text-slate-100 font-heading truncate max-w-[150px] sm:max-w-xs">
                    {user.displayName || "Valued User"}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 truncate max-w-[150px] sm:max-w-xs">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logOut}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow-md hover:shadow-lg transition-all duration-150 flex items-center group"
                aria-label="Log out"
              >
                <LogOutIcon size={18} className="mr-2 group-hover:animate-pulse-gentle-hover" /> Log Out
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full text-center py-2">
              <p className="text-sm text-slate-300 mb-3">Sign in with Google to save and sync your meal plans.</p>
              <Auth />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-6">
          <ChefHat size={60} className="text-teal-400 mb-3" />
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight font-heading">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-teal-400 to-sky-500">
              Shiv's Meal Planner
            </span>
          </h1>
          <p className="text-base text-slate-400 mt-3 max-w-xl">
            Craft your perfect diet with ease. Plan, track, and achieve your nutritional goals.
          </p>
        </div>

        {/* Toast Notifications Container */}
        <div className="fixed top-5 right-5 z-[100] space-y-3 w-full max-w-sm">
          {error && (
            <div className="p-4 bg-red-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl flex items-center space-x-3 animate-slideInTopRight" role="alert">
              <AlertCircle size={24} className="flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-4 bg-green-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl flex items-center space-x-3 animate-slideInTopRight" role="status">
              <Check size={24} className="flex-shrink-0" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}
        </div>
      </header>

      {/* Shopping List Modal */}
      {isShoppingListModalOpen && (
        <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn"
            onClick={() => setIsShoppingListModalOpen(false)}
            aria-modal="true" role="dialog" aria-labelledby="shopping-list-title"
        >
          <div
            className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-xl border border-slate-700 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
              <h2 id="shopping-list-title" className="text-2xl font-heading font-semibold text-teal-400 flex items-center">
                <ShoppingCart size={28} className="mr-3"/> Shopping List
              </h2>
              <button onClick={() => setIsShoppingListModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close shopping list">
                <X size={24} />
              </button>
            </div>

            {shoppingListItems.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <ListChecks size={40} className="mx-auto mb-3 text-slate-500" />
                <p className="font-medium">Your shopping list is empty.</p>
                <p className="text-sm">Add ingredients to your meals to see them here.</p>
              </div>
            ) : (
              <>
                <div className="overflow-y-auto flex-grow mb-4 pr-2 custom-scrollbar space-y-2.5">
                  {shoppingListItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center p-3 rounded-lg transition-all duration-150 ease-in-out border ${item.checked ? 'bg-slate-700/60 border-slate-600/50 opacity-70' : 'bg-slate-700/90 hover:bg-slate-600/80 border-slate-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleShoppingListItem(item.id)}
                        id={`item-${item.id}`}
                        className="h-5 w-5 rounded bg-slate-500 border-slate-400 text-teal-500 focus:ring-teal-500 accent-teal-500 cursor-pointer mr-3.5 flex-shrink-0"
                        aria-labelledby={`item-name-${item.id}`}
                      />
                      <label htmlFor={`item-${item.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-start">
                            <span id={`item-name-${item.id}`} className={`font-medium ${item.checked ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                            {item.ingredientName}
                            </span>
                            <span className={`text-sm font-semibold ml-2 flex-shrink-0 ${item.checked ? 'text-slate-500' : 'text-teal-300'}`}>
                            {item.quantity}
                            </span>
                        </div>
                        <div className={`text-xs mt-0.5 ${item.checked ? 'text-slate-500' : 'text-slate-400'}`} title={`Used in: ${item.mealNames}`}>
                            Meals: {item.mealNames.length > 50 ? item.mealNames.substring(0, 47) + "..." : item.mealNames}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={clearCheckedShoppingListItems}
                    disabled={!shoppingListItems.some(item => item.checked)}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center text-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Clear all checked items from the shopping list"
                  >
                    <Trash2 size={16} className="mr-2" /> Clear Checked
                  </button>
                   <button
                    onClick={printShoppingList}
                    disabled={shoppingListItems.length === 0}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center text-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Print shopping list"
                  >
                    <Printer size={16} className="mr-2" /> Print List
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      <main className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <button
                onClick={() => handleAddMeal()}
                className="bg-gradient-to-r from-teal-500 to-sky-600 hover:from-teal-600 hover:to-sky-700 text-white font-semibold py-3.5 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center text-lg focus:outline-none focus:ring-4 focus:ring-teal-300/70 animate-pulse-gentle-hover"
                aria-label="Add a new meal to your plan"
            >
                <PlusCircle size={24} className="mr-2.5" /> Add New Meal
            </button>
            <button
                onClick={() => setIsShoppingListModalOpen(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3.5 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300/70 animate-pulse-gentle-hover"
                aria-label="View shopping list"
            >
                <ShoppingCart size={24} className="mr-2.5" /> View Shopping List
            </button>
        </div>

        {meals.length === 0 && !isLoading && (
          <div className="text-center py-12 px-6 bg-slate-800/60 rounded-xl shadow-lg border border-slate-700/50">
            <Search size={48} className="text-slate-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold font-heading text-slate-200 mb-2">Your Meal Plan is Empty</h2>
            <p className="text-slate-400 mb-6">
              Start by adding a new meal manually. Once you have meals, you can generate a shopping list!
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleAddMeal()}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium py-2.5 px-5 rounded-lg shadow hover:shadow-md transition-colors"
              >
                Add First Meal
              </button>
            </div>
          </div>
        )}

        <div className="space-y-10">
            {meals.map((meal, index) => (
            <div key={meal.id} className="animate-fadeInUp" style={{ animationDelay: `${index * 100}ms`}}>
                <MealComponent
                    meal={meal}
                    onDuplicateMeal={() => handleAddMeal(undefined, meal)}
                    onRemoveMeal={handleRemoveMeal}
                    onUpdateMealName={handleUpdateMealName}
                    onAddIngredient={handleAddIngredient}
                    onRemoveIngredient={handleRemoveIngredient}
                    onUpdateIngredient={handleUpdateIngredient}
                />
            </div>
            ))}
        </div>
      </main>

      <footer className="text-center text-slate-500 mt-20 py-8 border-t border-slate-700/50 text-sm">
          <p>&copy; {new Date().getFullYear()} Shiv's Meal Planner.
            {user ? ` All changes are securely synced to your account.` : ` Sign in to save your progress.`}
          </p>
          <p className="mt-1.5">Happy planning! Keep up the great work! 💪</p>
      </footer>
    </div>
  );
}

export default App;
