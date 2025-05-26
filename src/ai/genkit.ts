
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Genkit and the googleAI plugin will automatically look for
// the GOOGLE_API_KEY environment variable if no apiKey is explicitly provided here.
// You can also provide it directly: googleAI({ apiKey: "YOUR_API_KEY" })
// For this application, the API key is managed via environment variable for backend operations.
// The settings page provides a UI to store it in localStorage for user reference or potential client-side use.

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
