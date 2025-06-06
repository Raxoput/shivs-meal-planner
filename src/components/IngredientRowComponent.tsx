import React, { useState, useEffect, ChangeEvent, FocusEvent } from 'react';
import { Ingredient } from '../types';
import { round } from '../constants';
import { Trash2 } from './icons';

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

    if (name !== 'name') {
      processedValue = value === '' ? '' : value; 
    }
    setValues((prev: Ingredient) => ({ ...prev, [name]: processedValue }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    let finalValue = values[name as keyof Ingredient];
    let changed = false;

    if (name !== 'name') {
      const currentValStr = String(values[name as keyof Ingredient]).trim();
      if (currentValStr === '') {
        finalValue = 0; 
        changed = String(values[name as keyof Ingredient]) !== String(finalValue);
      } else {
        const parsed = parseFloat(currentValStr);
        finalValue = isNaN(parsed) ? 0 : parsed; 
        changed = String(values[name as keyof Ingredient]) !== String(finalValue);
      }
    } else { 
        finalValue = String(values.name).trim();
        changed = values.name !== finalValue;
    }
    
    const updatedFullValues = { ...values, [name]: finalValue };
    if (changed) {
        setValues(updatedFullValues); 
    }
    onUpdate({ [name]: finalValue } as Partial<Ingredient>);
  };


  const getNumericValue = (field: keyof Ingredient): number => {
    const val = values[field];
    if (val === '' || val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }

  const calculated = {
    calories: round((getNumericValue('calories100g') / 100) * getNumericValue('grams')),
    protein: round((getNumericValue('protein100g') / 100) * getNumericValue('grams')),
    fat: round((getNumericValue('fat100g') / 100) * getNumericValue('grams')),
    carbs: round((getNumericValue('carbs100g') / 100) * getNumericValue('grams')),
  };

  const inputBaseClass = "w-full bg-slate-700/70 text-slate-100 p-2.5 rounded-md border border-slate-600/80 focus:ring-2 focus:ring-teal-500/70 focus:border-teal-500 outline-none transition-all duration-150";
  const numericInputClass = `${inputBaseClass} text-center`;
  const nameInputClass = `${inputBaseClass} text-left`;

  let rowClass = "border-b border-slate-700/60 hover:bg-slate-700/50 transition-colors duration-150";
  if (ingredient.isNew) {
    rowClass += " ingredient-row-enter";
  } else if (ingredient.isRemoving) {
    rowClass += " ingredient-row-exit";
  }

  return (
    <tr className={rowClass}>
      <td className="px-4 py-2.5">
        <input type="text" name="name" value={values.name} onChange={handleChange} onBlur={handleBlur} placeholder="Ingredient name" className={nameInputClass} aria-label="Ingredient name"/>
      </td>
      {(['calories100g', 'protein100g', 'fat100g', 'carbs100g', 'grams'] as const).map(field => (
        <td key={field} className="px-3 py-2.5">
          <input
            type="number"
            name={field}
            value={values[field] === '' || values[field] === null || values[field] === undefined ? '' : String(values[field])}
            onChange={handleChange}
            onBlur={handleBlur}
            className={numericInputClass}
            step="any"
            min="0"
            placeholder="0"
            aria-label={`${field.replace('100g', ' per 100g')}`}
          />
        </td>
      ))}
      <td className="px-3 py-2.5 text-center text-slate-200 font-medium">{calculated.calories}</td>
      <td className="px-3 py-2.5 text-center text-slate-200 font-medium">{calculated.protein}</td>
      <td className="px-3 py-2.5 text-center text-slate-200 font-medium">{calculated.fat}</td>
      <td className="px-3 py-2.5 text-center text-slate-200 font-medium">{calculated.carbs}</td>
      <td className="px-4 py-2.5 text-center">
        <button 
          onClick={onRemove} 
          className="text-slate-400 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-all duration-150 transform hover:scale-110" 
          aria-label="Remove ingredient"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}
  export default IngredientRowComponent;