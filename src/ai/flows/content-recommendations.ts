'use server';

/**
 * @fileOverview A content recommendation AI agent.
 *
 * - contentRecommendations - A function that handles the content recommendation process.
 * - ContentRecommendationsInput - The input type for the contentRecommendations function.
 * - ContentRecommendationsOutput - The return type for the contentRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ContentRecommendationsInputSchema = z.object({
  viewingHistory: z
    .string()
    .describe(
      'The viewing history of the user, including titles, genres, and ratings.'
    ),
  preferences: z.string().describe('The user preferences, such as preferred genres, actors, and directors.'),
});
export type ContentRecommendationsInput = z.infer<typeof ContentRecommendationsInputSchema>;

const ContentRecommendationsOutputSchema = z.object({
  recommendations: z
    .array(z.string())
    .describe('A list of recommended movie and TV show titles based on viewing history and preferences.'),
});
export type ContentRecommendationsOutput = z.infer<typeof ContentRecommendationsOutputSchema>;

export async function contentRecommendations(input: ContentRecommendationsInput): Promise<ContentRecommendationsOutput> {
  return contentRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'contentRecommendationsPrompt',
  input: {schema: ContentRecommendationsInputSchema},
  output: {schema: ContentRecommendationsOutputSchema},
  prompt: `You are an expert movie and TV show recommender.

Based on the user's viewing history and preferences, recommend movies and TV shows that the user might enjoy.

Viewing History: {{{viewingHistory}}}
Preferences: {{{preferences}}}

Recommendations:
`, // The output schema description will be added automatically.
});

const contentRecommendationsFlow = ai.defineFlow(
  {
    name: 'contentRecommendationsFlow',
    inputSchema: ContentRecommendationsInputSchema,
    outputSchema: ContentRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
