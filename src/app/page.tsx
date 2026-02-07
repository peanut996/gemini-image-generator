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
  const [referenceImages, setReferenceImages] = useState<Array<{data: string; mimeType: string}>>([]);
  const [imageCount, setImageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [completedCount, setCompletedCount] = useState(0);

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
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setReferenceImages(prev => [...prev, { data: base64, mimeType: file.type }]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateSingleImage = async (
    model: any,
    fullPrompt: string,
    variationIndex: number,
    referenceImages: Array<{data: string; mimeType: string}>
  ): Promise<GeneratedImage | null> => {
    try {
      let result;
      const promptWithVariation = variationIndex > 0 ? `${fullPrompt} (variation ${variationIndex + 1})` : fullPrompt;
      
      if (referenceImages.length > 0) {
        const contentParts = [
          ...referenceImages.map(img => ({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType,
            },
          })),
          promptWithVariation,
        ];
        result = await model.generateContent(contentParts);
      } else {
        result = await model.generateContent(promptWithVariation);
      }

      const response = result.response;
      const candidates = response.candidates;

      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content.parts;
        for (const part of parts) {
          if ((part as any).inlineData) {
            const inlineData = (part as any).inlineData;
            return {
              data: inlineData.data,
              mimeType: inlineData.mimeType,
            };
          }
        }
      }
    } catch (genError) {
      console.error(`Error generating image ${variationIndex + 1}:`, genError);
    }
    return null;
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
    setCompletedCount(0);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-pro-image-preview',
        generationConfig: {
          responseModalities: ['image', 'text'],
        } as any,
      });

      let fullPrompt = prompt;
      if (aspectRatio !== '1:1') {
        fullPrompt += ` (aspect ratio: ${aspectRatio})`;
      }

      // 并发生成所有图像
      const promises = Array.from({ length: imageCount }, (_, i) =>
        generateSingleImage(model, fullPrompt, i, referenceImages).then(image => {
          setCompletedCount(prev => prev + 1);
          if (image) {
            setGeneratedImages(prev => [...prev, image]);
          }
          return image;
        })
      );

      const results = await Promise.all(promises);
      const successfulImages = results.filter((img): img is GeneratedImage => img !== null);

      if (successfulImages.length === 0) {
        setError('无法生成图像，请尝试修改提示词或稍后重试');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (image: GeneratedImage, index: number) => {
    // 使用 Blob API 下载
    const byteCharacters = atob(image.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: image.mimeType });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-gray-800">
          Gemini 图像生成器
        </h1>
        <p className="text-center text-gray-500 mb-8">使用 Gemini 3 Pro Image 生成图像 • 客户端直连</p>

        {/* API Key Input */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            🔑 API Key
            <span className="text-gray-400 text-xs ml-2">(自动保存到浏览器)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="输入你的 Gemini API Key"
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-2">
            获取 API Key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>
          </p>
        </div>

        {/* Prompt Input */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            ✨ 提示词 (Prompt)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要生成的图像，例如：一只可爱的柴犬在樱花树下"
            rows={4}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none text-gray-900"
          />
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Count */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                🖼️ 生成数量
              </label>
              <select
                value={imageCount}
                onChange={(e) => setImageCount(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900"
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
              <label className="block text-sm font-medium mb-2 text-gray-700">
                📐 图像比例
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900"
              >
                <option value="1:1">1:1 (正方形)</option>
                <option value="16:9">16:9 (横屏)</option>
                <option value="9:16">9:16 (竖屏)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
          </div>

          {/* Reference Images */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              📷 参考图像 (可选，支持多张)
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="reference-image"
              />
              <label
                htmlFor="reference-image"
                className="cursor-pointer bg-gray-50 border border-gray-300 border-dashed rounded-lg px-6 py-3 hover:bg-gray-100 transition flex items-center gap-2 text-gray-600"
              >
                <span>选择图片</span>
              </label>
              {referenceImages.length > 0 && (
                <button
                  onClick={() => setReferenceImages([])}
                  className="text-red-500 hover:text-red-400 text-sm"
                >
                  清空全部
                </button>
              )}
            </div>
            {referenceImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {referenceImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={`Reference ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateImages}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] mb-6 shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              生成中... {completedCount}/{imageCount}
            </span>
          ) : (
            '🚀 生成图像'
          )}
        </button>

        {/* Progress Bar */}
        {loading && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / imageCount) * 100}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            ❌ {error}
          </div>
        )}

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">生成结果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={`data:${image.mimeType};base64,${image.data}`}
                    alt={`Generated ${index + 1}`}
                    className="w-full rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => downloadImage(image, index)}
                    className="absolute bottom-3 right-3 bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm shadow-md border border-gray-200 opacity-0 group-hover:opacity-100 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-8">
          Powered by Gemini 3 Pro Image • 客户端直连无超时限制 ✨
        </p>
      </div>
    </div>
  );
}
