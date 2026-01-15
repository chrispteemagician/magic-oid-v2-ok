exports.handler = async (event) => {
  // 1. Safety Check
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { image, mode } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    // --- 2. THE PERSONAS (V2: NO WAFFLE EDITION) ---
    const systemPrompt = mode === 'roast' 
      ? `You are "Roast-Oid", channeling the chaotic energy of 'Chris Doc Strange'. 
         
         TASK: Deliver a devastating ONE-LINER roast based on the photo.
         
         THE FORMULA (Combine these):
         1. **The Lookalike:** Identify a celebrity or famous magician they vaguely resemble.
         2. **The Tragic Twist:** Describe them as the "failed magician version" of that celebrity.
         
         EXAMPLES:
         - "You look like a damp Liberace that laps coins in thumbtips."
         - "It's giving George Clooney if he gave up acting to sell Svengali decks at a car boot sale."
         - "You resemble Harry Potter, but with more chin and less talent."
         
         CONSTRAINTS:
         - **DO NOT** start with "Right then", "Okay", "Let's see", "Good heavens", or "Oh my".
         - START IMMEDIATELY with the insult.
         - MAX 2 SENTENCES.
         - British spelling/slang.
         - NO questions.`
      
      : `You are "Magic-Oid", channeling 'Chris P Tee'. Kind, supportive, knowledgeable.
         
         TASK: Identify this magic item/prop.
         
         STRUCTURE:
         1. 🔮 THE GEAR: Exact Name, Creator, Maker.
         2. ✨ THE MAGIC: What the audience sees (Punchy description).
         3. 💰 THE DAMAGE: Valuation (Vintage vs Modern). Honest but kind.
         4. 📚 LEVEL UP: Suggest a specific book or complementary trick.
         
         CRITICAL - THE AMAZON CLOSE:
         End with a recommendation link formatted EXACTLY like this:
         [👉 Grab the [Insert Item/Book Name] on Amazon](https://www.amazon.co.uk/s?k=[Insert+Search+Terms+Here]&tag=chrisptee-21)
         
         CONSTRAINTS:
         - **DO NOT** start with "Right then", "Right", or "Let's have a look". Just start with the answer.
         - Do NOT expose the secret method. Keep the mystery alive.`;

    // --- 3. AUTO-DISCOVERY (The Skeleton Key) ---
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResp = await fetch(listUrl);
    
    let availableModels = ["models/gemini-1.5-flash", "models/gemini-1.5-pro", "models/gemini-pro"];
    
    if (listResp.ok) {
      const listData = await listResp.json();
      availableModels = listData.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name)
        .sort((a, b) => b.localeCompare(a)); 
    }

    let lastError = "";

    // --- 4. THE LOOP ---
    for (const modelName of availableModels) {
      if (modelName.includes("gemini-1.0-pro") && !modelName.includes("vision")) continue;

      console.log(`Trying model: ${modelName}...`);
      
      try {
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemPrompt },
                { inlineData: { mimeType: "image/jpeg", data: image.data } }
              ]
            }],
            // --- THE SAFETY PATCH (Allow the Roast) ---
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
          })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error?.message || `Status ${response.status}`);
        
        // Handle Safety Block Gracefully
        if (data.candidates?.[0]?.finishReason === "SAFETY") {
          return { statusCode: 200, body: JSON.stringify({ result: "🚫 **Roast Blocked:** The AI Safety Police stepped in! Doc Strange was too savage. Try a different face!" }) };
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Model returned empty response");

        // Success!
        return { statusCode: 200, body: JSON.stringify({ result: text }) };

      } catch (err) {
        console.log(`Failed on ${modelName}: ${err.message}`);
        lastError = `Model ${modelName} failed: ${err.message}`;
      }
    }

    throw new Error(`All models failed. Last error: ${lastError}`);

  } catch (error) {
    console.error("Fatal Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};