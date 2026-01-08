/**
 * Parses an error object and returns a user-friendly error message.
 * Handles Firebase Auth, Firestore, and generic JS errors.
 * 
 * @param error The error object or string
 * @returns A string message suitable for display to the user
 */
export const getUserFriendlyErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred.';

    // If it's already a string, clean it up or return as is
    if (typeof error === 'string') {
        return error;
    }

    const message = error.message || '';
    const code = error.code || '';

    // --- Firebase Auth Errors ---
    if (code === 'auth/invalid-email') return 'The email address is invalid.';
    if (code === 'auth/user-disabled') return 'This account has been disabled.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/wrong-password') return 'Incorrect password.';
    if (code === 'auth/email-already-in-use') return 'This email is already in use by another account.';
    if (code === 'auth/weak-password') return 'The password is too weak. Please use a stronger password.';
    if (code === 'auth/operation-not-allowed') return 'This operation is not allowed.';
    if (code === 'auth/invalid-credential') return 'Invalid credentials provided.';
    if (code === 'auth/too-many-requests') return 'Too many failed attempts. Please try again later.';

    // --- Firestore / Permission Errors ---
    if (code === 'permission-denied' || message.includes('insufficient permissions')) {
        return 'You do not have permission to perform this action.';
    }
    if (code === 'unavailable') return 'The service is currently unavailable. Please check your internet connection.';

    // --- Data / Validation Errors ---
    if (message.includes('undefined') && message.includes('field value')) {
        return 'Some required data is missing. Please ensure all fields are filled out correctly.';
    }

    // Generic "One or more fields are empty" catch
    if (message.toLowerCase().includes('empty') || message.toLowerCase().includes('missing')) {
        return message; // Often manual throws like "Name is missing" are good enough
    }

    // --- Fallback ---
    // If it's a specific Firebase error message that is somewhat readable, we can try to clean it
    // But for now, returning the message (if short) or a generic one is safer.
    if (message.length < 100) {
        return message;
    }

    return 'Something went wrong. Please try again or contact support.';
};
