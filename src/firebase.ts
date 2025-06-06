import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- TEMPORARY DIAGNOSTIC CONFIGURATION ---
// We are hard-coding the keys to test if the environment variables are the problem.
// Go to your .env file and copy the values directly here.
const firebaseConfig = {
  apiKey: "AIzaSyAQkJO9WgtZRH3OQ_QxaICpYEy_4S-uHBI",
  authDomain: "shivs-meal-planner-f571f.firebaseapp.com",
  projectId: "shivs-meal-planner-f571f",
  storageBucket: "shivs-meal-planner-f571f.firebasestorage.app",
  messagingSenderId: "1087771620132",
  appId: "1:1087771620132:web:fb107f419b72d186f1b9b1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);