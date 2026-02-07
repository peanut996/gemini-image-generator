'use client';

import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeneratedImage {
  data: string;
  mimeType: string;
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageMime, setReferenceImageMime] = useState<string>('');
  const [imageCount, setImageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [progress, setProgress] = useState(0);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) {
      localStorage.setItem('gemini-api-key', value);
    } else {
      localStorage.removeItem('gemini-api-key');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceImageMime(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImages = async () => {
    if (!apiKey) {
      setError('请输入 API Key');
      return;
    }
    if (!prompt) {
      setError('请输入提示词');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedImages([]);
    setProgress(0);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 使用 gemini-2.0-flash-exp 模型进行图像生成
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseModalities: ['image', 'text'],
        } as any,
      });

      const images: GeneratedImage[] = [];

      // 构建提示词，包含图像比例要求
      let fullPrompt = prompt;
      if (aspectRatio !== '1:1') {
        fullPrompt += ` (aspect ratio: ${aspectRatio})`;
      }

      // 生成指定数量的图像
      for (let i = 0; i < imageCount; i++) {
        setProgress(Math.round(((i) / imageCount) * 100));
        
        try {
          let result;
          
          if (referenceImage && referenceImageMime) {
            // 如果有参考图像，一起发送
            result = await model.generateContent([
              {
                inlineData: {
                  data: referenceImage,
                  mimeType: referenceImageMime,
                },
              },
              fullPrompt + (imageCount > 1 ? ` (variation ${i + 1})` : ''),
            ]);
          } else {
            result = await model.generateContent(
              fullPrompt + (imageCount > 1 ? ` (variation ${i + 1})` : '')
            );
          }

          const response = result.response;
          const candidates = response.candidates;

          if (candidates && candidates.length > 0) {
            const parts = candidates[0].content.parts;
            for (const part of parts) {
              if ((part as any).inlineData) {
                const inlineData = (part as any).inlineData;
                images.push({
                  data: inlineData.data,
                  mimeType: inlineData.mimeType,
                });
                // 实时更新生成的图像
                setGeneratedImages([...images]);
              }
            }
          }
        } catch (genError) {
          console.error(`Error generating image ${i + 1}:`, genError);
          // 继续生成其他图像
        }
      }

      setProgress(100);

      if (images.length === 0) {
        setError('无法生成图像，请尝试修改提示词或稍后重试');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (image: GeneratedImage, index: number) => {
    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.data}`;
    link.download = `generated-image-${index + 1}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
          Gemini 图像生成器
        </h1>
        <p className="text-center text-gray-400 mb-8">使用 Google Gemini 2.0 Flash 生成图像 • 客户端直连</p>

        {/* API Key Input */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 backdrop-blur-sm border border-gray-700">
          <label className="block text-sm font-medium mb-2 text-purple-300">
            🔑 API Key
            <span className="text-gray-500 text-xs ml-2">(自动保存到浏览器)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="输入你的 Gemini API Key"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-500 mt-2">
            获取 API Key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Google AI Studio</a>
          </p>
        </div>

        {/* Prompt Input */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 backdrop-blur-sm border border-gray-700">
          <label className="block text-sm font-medium mb-2 text-purple-300">
            ✨ 提示词 (Prompt)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要生成的图像，例如：一只可爱的柴犬在樱花树下"
            rows={4}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Settings */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 backdrop-blur-sm border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Count */}
            <div>
              <label className="block text-sm font-medium mb-2 text-purple-300">
                🖼️ 生成数量
              </label>
              <select
                value={imageCount}
                onChange={(e) => setImageCount(Number(e.target.value))}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              >
                {[1, 2, 3, 4].map((num) => (
                  <option key={num} value={num}>
                    {num} 张
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium mb-2 text-purple-300">
                📐 图像比例
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              >
                <option value="1:1">1:1 (正方形)</option>
                <option value="16:9">16:9 (横屏)</option>
                <option value="9:16">9:16 (竖屏)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
          </div>

          {/* Reference Image */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2 text-purple-300">
              📷 参考图像 (可选)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="reference-image"
              />
              <label
                htmlFor="reference-image"
                className="cursor-pointer bg-gray-700/50 border border-gray-600 border-dashed rounded-lg px-6 py-3 hover:bg-gray-600/50 transition flex items-center gap-2"
              >
                <span>选择图片</span>
              </label>
              {referenceImage && (
                <div className="flex items-center gap-2">
                  <img
                    src={`data:${referenceImageMime};base64,${referenceImage}`}
                    alt="Reference"
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setReferenceImage(null);
                      setReferenceImageMime('');
                    }}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    移除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateImages}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] mb-6"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              生成中... {progress}%
            </span>
          ) : (
            '🚀 生成图像'
          )}
        </button>

        {/* Progress Bar */}
        {loading && (
          <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-red-300">
            ❌ {error}
          </div>
        )}

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-purple-300">生成结果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={`data:${image.mimeType};base64,${image.data}`}
                    alt={`Generated ${index + 1}`}
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={() => downloadImage(image, index)}
                    className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    💾 下载
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Powered by Google Gemini 2.0 Flash • 客户端直连无超时限制 ✨
        </p>
      </div>
    </div>
  );
}
