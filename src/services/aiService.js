import axios from 'axios';
import { config } from '../config/env';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const analyzeImageWithAI = async (imageUrl) => {
  try {
    console.log('Sending request to OpenAI with image:', imageUrl);
    
    // Check if API key is configured
    if (!config.openai.apiKey || config.openai.apiKey.includes('your-openai-api-key-here')) {
      console.warn('OpenAI API key not configured, using fallback detection');
      return [
        { name: 'phone', x: 30, y: 40 },
        { name: 'table', x: 60, y: 70 },
        { name: 'book', x: 45, y: 25 }
      ]; // Fallback for demo
    }
    
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: config.openai.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and identify all objects with their approximate positions. 
                       For each object, estimate its position as a percentage from the top-left corner.
                       Return a JSON array like this:
                       [
                         {"name": "phone", "x": 25, "y": 30},
                         {"name": "book", "x": 70, "y": 60}
                       ]
                       Where x is percentage from left (0-100) and y is percentage from top (0-100).
                       Focus on clearly visible objects. Only return the JSON array, no other text.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('Raw OpenAI response:', aiResponse);
    
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      
      // Remove markdown code block formatting
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanResponse = cleanResponse.trim();
      console.log('Cleaned response for parsing:', cleanResponse);
      
      // Parse the JSON response
      const detectedObjects = JSON.parse(cleanResponse);
      
      // Validate that it's an array
      if (Array.isArray(detectedObjects)) {
        // Check if objects have coordinates (new format) or just names (old format)
        if (detectedObjects.length > 0 && typeof detectedObjects[0] === 'object' && detectedObjects[0].name) {
          // New format with coordinates
          const objectsWithCoords = detectedObjects.map(obj => ({
            name: obj.name.toLowerCase().trim(),
            x: Math.max(0, Math.min(100, obj.x || 50)), // Ensure x is between 0-100
            y: Math.max(0, Math.min(100, obj.y || 50)), // Ensure y is between 0-100
          }));
          console.log('Detected objects with coordinates:', objectsWithCoords);
          return objectsWithCoords;
        } else {
          // Old format - just names, add random coordinates
          const objectsWithRandomCoords = detectedObjects.map((objName, index) => ({
            name: objName.toLowerCase().trim(),
            x: 20 + (index * 15) % 60, // Distribute across width
            y: 20 + (index * 20) % 60, // Distribute across height
          }));
          console.log('Detected objects (added random coordinates):', objectsWithRandomCoords);
          return objectsWithRandomCoords;
        }
      } else {
        console.warn('AI response is not an array:', aiResponse);
        return [{ name: 'unknown object', x: 50, y: 50 }];
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('Raw AI response:', aiResponse);
      
      // Fallback: try to extract objects from text response
      const fallbackObjects = extractObjectsFromText(aiResponse);
      const objectsWithCoords = fallbackObjects.map((objName, index) => ({
        name: objName,
        x: 25 + (index * 20) % 50, // Distribute across width
        y: 25 + (index * 25) % 50, // Distribute across height
      }));
      return objectsWithCoords.length > 0 ? objectsWithCoords : [{ name: 'detected object', x: 50, y: 50 }];
    }
  } catch (error) {
    console.error('Error analyzing image with AI:', error);
    
    if (error.response) {
      console.error('OpenAI API Error:', error.response.status, error.response.data);
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - OpenAI API took too long to respond');
    }
    
    // Return fallback objects for demo purposes
    return [
      { name: 'camera', x: 40, y: 50 },
      { name: 'object', x: 65, y: 35 }
    ];
  }
};

// Fallback function to extract objects from text response
const extractObjectsFromText = (text) => {
  // Simple regex to find words that might be objects
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  
  // Filter common objects and return unique ones
  const commonObjects = [
    'chair', 'table', 'book', 'phone', 'laptop', 'cup', 'bottle', 'bag',
    'keys', 'glasses', 'pen', 'paper', 'clock', 'lamp', 'plant', 'picture',
    'computer', 'mouse', 'keyboard', 'monitor', 'headphones', 'camera',
    'wallet', 'watch', 'shoe', 'shirt', 'jacket', 'hat', 'pillow', 'blanket'
  ];
  
  const foundObjects = words.filter(word => commonObjects.includes(word));
  return [...new Set(foundObjects)].slice(0, 5); // Return up to 5 unique objects
};

// Alternative AI service using Google Gemini (uncomment to use)
/*
const GEMINI_API_KEY = 'your-gemini-api-key-here';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';

export const analyzeImageWithGemini = async (imageUrl) => {
  try {
    // Convert image URL to base64 (you might need to implement this)
    const base64Image = await convertImageToBase64(imageUrl);
    
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: "List all objects you can identify in this image. Return only a JSON array of object names."
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    const aiResponse = response.data.candidates[0].content.parts[0].text;
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    return ['demo object'];
  }
};
*/ 