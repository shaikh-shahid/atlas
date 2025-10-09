/**
 * Centralized prompt templates for LLM interactions
 */

const prompts = {
  /**
   * Analyze if a new query relates to previous context
   */
  contextDetection: (previousQuery, newQuery) => {
    return `You are a context analyzer. Determine if the new query is related to the previous query.

Previous Query: "${previousQuery}"
New Query: "${newQuery}"

Answer with ONLY "YES" if the new query refers to or follows up on the previous query, or "NO" if it's a completely new topic.

Examples:
Previous: "What is machine learning?"
New: "How does it work?" → YES

Previous: "Capital of France"
New: "Best pizza recipes" → NO

Previous: "Climate change effects"
New: "What about sea levels?" → YES

Answer (YES or NO):`;
  },

  /**
   * Rewrite a query with context for better search results
   */
  queryRewriting: (previousQuery, newQuery, conversationHistory = []) => {
    const historyContext = conversationHistory.length > 0
      ? `\n\nConversation History:\n${conversationHistory.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`
      : '';

    return `You are a search query optimizer. Rewrite the follow-up query to be standalone and searchable, incorporating context from the previous query.${historyContext}

Previous Query: "${previousQuery}"
Follow-up Query: "${newQuery}"

Rewrite the follow-up query to be clear and self-contained for a search engine. Include relevant context from the previous query. Keep it concise (under 100 characters).

Examples:
Previous: "What is diabetes?"
Follow-up: "What are the symptoms?"
Rewritten: "What are the symptoms of diabetes?"

Previous: "Tesla Model 3 review"
Follow-up: "How much does it cost?"
Rewritten: "Tesla Model 3 price and cost"

Previous: "Python programming tutorial"
Follow-up: "What about loops?"
Rewritten: "Python loops tutorial"

Rewritten Query:`;
  },

  /**
   * Main answer generation prompt with RAG
   */
  answerGeneration: (question, formattedSources) => {
    return `You are an intelligent search assistant. Your task is to provide accurate, well-structured answers based ONLY on the information from the provided sources.

CRITICAL INSTRUCTIONS:
1. Answer based ONLY on the provided sources - do not add external knowledge
2. Use numbered citations [1], [2], etc. throughout your answer
3. Format your answer in Markdown with clear structure
4. Use ## for main headings, **bold** for emphasis
5. Use bullet points (-) or numbered lists (1.) where appropriate
6. Separate paragraphs with double line breaks (\n\n)
7. If sources conflict, present both viewpoints with citations
8. If sources don't contain enough information, acknowledge limitations
9. Be concise but comprehensive - aim for clarity
10. Do NOT include a "References" section at the end
11. Do NOT return HTML code

Question: ${question}

Sources:
${formattedSources}

Now provide a well-structured, intelligent answer with inline citations:`;
  },

  /**
   * Related questions generation
   */
  relatedQuestions: (question, answer = null) => {
    const answerContext = answer ? `\n\nContext from answer:\n${answer.slice(0, 500)}...` : '';
    
    return `Generate 5 concise, relevant follow-up questions based on this query${answer ? ' and answer' : ''}.${answerContext}

Original Question: "${question}"

Generate exactly 5 follow-up questions that:
- Are natural and conversational
- Explore different aspects of the topic
- Are under 80 characters each
- Are specific and actionable
- End with a question mark

IMPORTANT: Return ONLY a valid JSON array like this example, with no extra text:
["What are the main types of machine learning?", "How does deep learning differ from traditional ML?", "What are common applications of machine learning?", "What programming languages are used for ML?", "How much data is needed to train ML models?"]

Your JSON array:`;
  },

  /**
   * Topic extraction for context management
   */
  topicExtraction: (query) => {
    return `Extract the main topic/subject from this query in 2-4 words. Be specific but concise.

Query: "${query}"

Examples:
Query: "What are the health benefits of green tea?" → "green tea benefits"
Query: "How does quantum computing work?" → "quantum computing"
Query: "Best practices for React hooks" → "React hooks"
Query: "Climate change impact on polar bears" → "climate change polar bears"

Topic:`;
  },
};

module.exports = prompts;
