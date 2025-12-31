// SnapFindMy Configuration
// Please update these values with your actual API keys and endpoints

export const config = {
  // Supabase Configuration
  // Get these from your Supabase project dashboard: https://supabase.com/dashboard
  supabase: {
    url: 'https://vmqeqskcrnotoayvgtqt.supabase.co',
    anonKey: 'your-anon-key-here',
  },

  // OpenAI Configuration
  // Get your API key from: https://platform.openai.com/api-keys
  openai: {
    apiKey: 'your-openai-api-key-here',
    model: 'gpt-4o', // Using the latest model
  },

  // Alternative: Google Gemini Configuration (optional)
  // Get your API key from: https://makersuite.google.com/app/apikey
  gemini: {
    apiKey: 'your-gemini-api-key-here',
  },

  // App Settings
  app: {
    name: 'SnapFindMy',
    version: '1.0.0',
    enableOfflineMode: true,
    maxImagesPerUser: 100,
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
  },


}; 