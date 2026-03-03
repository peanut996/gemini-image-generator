'use client';

import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeneratedImage {
  data: string;
  mimeType: string;
}

interface UsageInfo {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  imageCount: number;
  cost: number;
}

// 定价表 (USD per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; outputText: number; outputImage: number }> = {
  'gemini-3.1-flash-image-preview': { input: 0.25, outputText: 1.50, outputImage: 60.00 },
  'gemini-3-pro-image-preview': { input: 2.00, outputText: 12.00, outputImage: 120.00 },
};

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
  const [showPresetImages, setShowPresetImages] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image-preview');
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);

  const modelOptions = [
    { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', description: 'Gemini 3.1 Flash' },
    { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', description: 'Gemini 3 Pro' },
  ];

  const presetImages = [
    { src: '/presets/pixel-wedding-main.jpg', label: '像素婚礼' },
    { src: '/presets/pixel-couple-1.jpg', label: '像素情侣1' },
    { src: '/presets/pixel-couple-2.jpg', label: '像素情侣2' },
    { src: '/presets/pixel-couple-3.jpg', label: '像素情侣3' },
    { src: '/presets/pixel-selfie.jpg', label: '像素自拍' },
    { src: '/presets/pixel-wedding-1.jpg', label: '像素婚礼2' },
    { src: '/presets/pixel-wedding-cn-1.jpg', label: '中式婚礼1' },
    { src: '/presets/pixel-wedding-cn-2.jpg', label: '中式婚礼2' },
    { src: '/presets/pixel-ancient.jpg', label: '像素古风' },
    { src: '/presets/pixel-girls.jpg', label: '像素闺蜜' },
    { src: '/presets/pixel-cat-1.jpg', label: '像素猫1' },
    { src: '/presets/pixel-cat-2.jpg', label: '像素猫2' },
    { src: '/presets/pixel-dog.jpg', label: '像素狗' },
    { src: '/presets/anime-sticker-1.jpg', label: '二次元贴纸1' },
    { src: '/presets/anime-sticker-2.jpg', label: '二次元贴纸2' },
    { src: '/presets/anime-sticker-girl.jpg', label: '二次元女生' },
    { src: '/presets/chibi-couple.jpg', label: 'Q版情侣' },
    { src: '/presets/chibi-couple-1.jpg', label: 'Q版证件照' },
    { src: '/presets/chibi-winter-couple.jpg', label: '双人卡通' },
    { src: '/presets/chibi-wedding-couple.jpg', label: '双人结婚照' },
    { src: '/presets/chibi-wedding-dress-couple.jpg', label: '双人婚纱照' },
  ];

  const presetPrompts = [
    {
      label: '🎨 二次元贴纸',
      prompt: '参考图二的绘图风格，把图一变成帅气美丽又可爱的二次元sticker吧，要确保完全还原图一人物的服饰、发型和动作',
    },
    {
      label: '👾 像素风格',
      prompt: 'refer to image 2, convert image 1 into a pixel art. Try to use as few pixels as possible.确保完全还原图一人物的动作服饰和发型',
    },
    {
      label: '👾 像素风格 (保留设计)',
      prompt: 'refer to image 2, convert image 1 into a pixel art. Try to use as few pixels as possible while fully preserving the original design. 确保完全还原图一人物的动作服饰和发型',
    },
    {
      label: '🌾 星露谷风格',
      prompt: '参考图二的风格，把图一也变成星露谷小人吧，最终的出图越小越好',
    },
    {
      label: '👾 像素风格 (白色背景)',
      prompt: 'refer to image 2, convert image 1 into a pixel art. Try to use as few pixels as possible while fully preserving the original design and ensuring the final result has white background.',
    },
    {
      label: '👾 像素精简版',
      prompt: 'refer to image 2, convert image 1 into a pixel art. Try to use as few pixels as possible.尽可能精简的同时，保留动作和特征',
    },
  ];

  // Load API key and last prompt from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      setApiKey(savedKey);
    }
    const savedPrompt = localStorage.getItem('gemini-last-prompt');
    if (savedPrompt) {
      setPrompt(savedPrompt);
    }
    const savedModel = localStorage.getItem('gemini-selected-model');
    if (savedModel) {
      setSelectedModel(savedModel);
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

  // Save prompt to localStorage when it changes
  const handlePromptChange = (value: string) => {
    setPrompt(value);
    localStorage.setItem('gemini-last-prompt', value);
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem('gemini-selected-model', value);
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

  const addPresetImage = async (src: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setReferenceImages(prev => [...prev, { data: base64, mimeType: blob.type }]);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load preset image:', err);
    }
  };

  const generateSingleImage = async (
    model: any,
    fullPrompt: string,
    variationIndex: number,
    referenceImages: Array<{data: string; mimeType: string}>
  ): Promise<{ image: GeneratedImage | null; usage: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number } | null }> => {
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
      const usage = response.usageMetadata ? {
        promptTokenCount: response.usageMetadata.promptTokenCount ?? 0,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount ?? 0,
        totalTokenCount: response.usageMetadata.totalTokenCount ?? 0,
      } : null;
      const candidates = response.candidates;

      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content.parts;
        for (const part of parts) {
          if ((part as any).inlineData) {
            const inlineData = (part as any).inlineData;
            return {
              image: { data: inlineData.data, mimeType: inlineData.mimeType },
              usage,
            };
          }
        }
      }
      return { image: null, usage };
    } catch (genError) {
      console.error(`Error generating image ${variationIndex + 1}:`, genError);
      const errMsg = genError instanceof Error
        ? `Image ${variationIndex + 1}: ${genError.message}\n${genError.stack ?? ''}`
        : `Image ${variationIndex + 1}: ${String(genError)}`;
      throw new Error(errMsg);
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
    setCompletedCount(0);
    setUsageInfo(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      const model = genAI.getGenerativeModel({
        model: selectedModel,
        generationConfig: {
          responseModalities: ['image', 'text'],
        } as any,
      });

      let fullPrompt = prompt;
      if (aspectRatio !== '1:1') {
        fullPrompt += ` (aspect ratio: ${aspectRatio})`;
      }

      let totalPromptTokens = 0;
      let totalCandidatesTokens = 0;
      let totalTokens = 0;
      let generatedCount = 0;

      // 并发生成所有图像
      const promises = Array.from({ length: imageCount }, (_, i) =>
        generateSingleImage(model, fullPrompt, i, referenceImages).then(({ image, usage }) => {
          setCompletedCount(prev => prev + 1);
          if (usage) {
            totalPromptTokens += usage.promptTokenCount;
            totalCandidatesTokens += usage.candidatesTokenCount;
            totalTokens += usage.totalTokenCount;
          }
          if (image) {
            generatedCount++;
            setGeneratedImages(prev => [...prev, image]);
          }
          return { image, usage };
        })
      );

      const results = await Promise.allSettled(promises);

      // 计算费用
      const pricing = MODEL_PRICING[selectedModel];
      if (pricing && totalTokens > 0) {
        const inputCost = (totalPromptTokens / 1_000_000) * pricing.input;
        const outputImageCost = (totalCandidatesTokens / 1_000_000) * pricing.outputImage;
        setUsageInfo({
          promptTokenCount: totalPromptTokens,
          candidatesTokenCount: totalCandidatesTokens,
          totalTokenCount: totalTokens,
          imageCount: generatedCount,
          cost: inputCost + outputImageCost,
        });
      }

      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason instanceof Error ? `${r.reason.message}\n${r.reason.stack ?? ''}` : String(r.reason));
      const successfulImages = results
        .filter((r): r is PromiseFulfilledResult<{ image: GeneratedImage | null; usage: any }> => r.status === 'fulfilled')
        .map(r => r.value.image)
        .filter((img): img is GeneratedImage => img !== null);

      if (successfulImages.length === 0 && errors.length === 0) {
        setError('无法生成图像，请尝试修改提示词或稍后重试');
      } else if (errors.length > 0) {
        setError(errors.join('\n\n'));
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : '生成失败');
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
        <p className="text-center text-gray-500 mb-8">使用 {modelOptions.find(m => m.value === selectedModel)?.label ?? 'Gemini'} 生成图像 • 客户端直连</p>

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
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="描述你想要生成的图像，例如：一只可爱的柴犬在樱花树下"
            rows={4}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none text-gray-900"
          />
          {/* Preset Prompts */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">快捷预设：</p>
            <div className="flex flex-wrap gap-2">
              {presetPrompts.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptChange(preset.prompt)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition border border-gray-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
          {/* Model Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              🧠 模型选择
            </label>
            <div className="flex flex-wrap gap-2">
              {modelOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleModelChange(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                    selectedModel === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className={`ml-1.5 text-xs ${selectedModel === option.value ? 'text-blue-200' : 'text-gray-400'}`}>
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

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
              <button
                onClick={() => setShowPresetImages(true)}
                className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-3 hover:bg-blue-100 transition flex items-center gap-2 text-blue-600"
              >
                <span>📁 预设图片</span>
              </button>
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600 whitespace-pre-wrap break-all text-sm font-mono">
            ❌ {error}
          </div>
        )}

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">生成结果</h2>
              {usageInfo && (
                <div className="text-right text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
                    <span>Tokens: {usageInfo.promptTokenCount.toLocaleString()} in / {usageInfo.candidatesTokenCount.toLocaleString()} out</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-green-600 font-medium">${usageInfo.cost.toFixed(4)}</span>
                  </span>
                </div>
              )}
            </div>
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
                    className="absolute bottom-3 right-3 bg-white hover:bg-gray-100 text-gray-700 p-2 md:px-4 md:py-2 rounded-lg text-sm shadow-md border border-gray-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden md:inline">下载</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-8">
          Powered by {modelOptions.find(m => m.value === selectedModel)?.label ?? 'Gemini'} • 客户端直连无超时限制 ✨
        </p>
      </div>

      {/* Preset Images Modal */}
      {showPresetImages && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPresetImages(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">选择预设图片</h3>
              <button
                onClick={() => setShowPresetImages(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">点击图片添加到参考图列表</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {presetImages.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    addPresetImage(preset.src);
                    setShowPresetImages(false);
                  }}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition"
                >
                  <img
                    src={preset.src}
                    alt={preset.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end justify-center">
                    <span className="text-white text-xs pb-2 opacity-0 group-hover:opacity-100 transition">
                      {preset.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
