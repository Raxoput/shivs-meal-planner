import { auth } from "./firebase"; // Import our auth service
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export const Auth = () => {

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
    </div>
  );
};