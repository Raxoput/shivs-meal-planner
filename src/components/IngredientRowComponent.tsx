import React, { useState, useEffect, ChangeEvent, FocusEvent } from 'react';
import { Ingredient } from '@/types';
import { round } from '@/constants';
import { Trash2 } from './icons'; // Relative path to sibling component

interface IngredientRowProps {
  ingredient: Ingredient;
  onUpdate: (updatedValues: Partial<Ingredient>) => void;
  onRemove: () => void;
}

const IngredientRowComponent: React.FC<IngredientRowProps> = ({ ingredient, onUpdate, onRemove }) => {
  const [values, setValues] = useState<Ingredient>(ingredient);

  useEffect(() => {
    setValues(ingredient);
  }, [ingredient]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue: string | number = value;

    if (name !== 'name') { // For numeric fields
      processedValue = value === '' ? '' : value; // Keep as string for controlled input, parse on blur
    }
    setValues(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    let finalValue = values[name as keyof Ingredient];

    if (name !== 'name') {
      const parsed = parseFloat(String(values[name as keyof Ingredient]));
      finalValue = isNaN(parsed) ? 0 : parsed;
    }
    
    const updatedFullValues = { ...values, [name]: finalValue };
    // Update local state to reflect cleaned value if it changed (e.g. "abc" -> 0)
    if (String(values[name as keyof Ingredient]) !== String(finalValue)) {
        setValues(updatedFullValues);
    }
    onUpdate(updatedFullValues);
  };

  const getNumericValue = (field: keyof Ingredient): number => {
    const val = values[field];
    if (val === '' || val === null || val === undefined) return 0; // Treat empty string as 0 for calculation
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }

  const calculated = {
    calories: round((getNumericValue('calories100g') / 100) * getNumericValue('grams')),
    protein: round((getNumericValue('protein100g') / 100) * getNumericValue('grams')),
    fat: round((getNumericValue('fat100g') / 100) * getNumericValue('grams')),
    carbs: round((getNumericValue('carbs100g') / 100) * getNumericValue('grams')),
  };

  const inputClass = "w-full bg-slate-700 text-slate-100 p-2 rounded-md border border-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-center";
  const nameInputClass = "w-full bg-slate-700 text-slate-100 p-2 rounded-md border border-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-left";

  return (
    <tr className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-2">
        <input type="text" name="name" value={values.name} onChange={handleChange} onBlur={handleBlur} placeholder="Ingredient name" className={nameInputClass} />
      </td>
      {(['calories100g', 'protein100g', 'fat100g', 'carbs100g', 'grams'] as const).map(field => (
        <td key={field} className="px-4 py-2">
          <input
            type="number" // Using type number for native validation and spinners, but still handling string state
            name={field}
            value={values[field] === '' || values[field] === null || values[field] === undefined ? '' : String(values[field])}
            onChange={handleChange}
            onBlur={handleBlur}
            className={inputClass}
            step="any"
            min="0"
            placeholder="0"
          />
        </td>
      ))}
      <td className="px-4 py-2 text-center text-slate-50">{calculated.calories}</td>
      <td className="px-4 py-2 text-center text-slate-50">{calculated.protein}</td>
      <td className="px-4 py-2 text-center text-slate-50">{calculated.fat}</td>
      <td className="px-4 py-2 text-center text-slate-50">{calculated.carbs}</td>
      <td className="px-4 py-2 text-center">
        <button onClick={onRemove} className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-slate-600" aria-label="Remove ingredient">
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}
export default IngredientRowComponent;
