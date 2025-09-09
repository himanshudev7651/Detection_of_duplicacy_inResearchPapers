// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@^4.5.136/build/pdf.worker.mjs`;

const App = () => {
    // --- IMPORTANT ---
    // PASTE YOUR GEMINI API KEY IN THE LINE BELOW
    const API_KEY = "YOUR_API_KEY_HERE";

    // UI State
    const [activeTab, setActiveTab] = useState('paste');
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [reportLanguage, setReportLanguage] = useState('English');
    const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

    // Data State
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isRevising, setIsRevising] = useState(false);
    const [revisionSuggestions, setRevisionSuggestions] = useState('');
    const [revisionError, setRevisionError] = useState('');

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setError('');
    };

    const parseFile = async (file) => {
        if (!file) return;

        setFileName(file.name);
        setIsLoading(true);
        setError('');
        try {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map(item => item.str).join(' ');
                }
                setInputText(textContent);
            } else if (file.type === 'text/plain') {
                const text = await file.text();
                setInputText(text);
            } else {
                throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
            }
        } catch (e) {
            setError(e.message);
            setFileName('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            parseFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            parseFile(file);
        }
    };

    const handleCheckDuplicacy = async () => {
        if (API_KEY === "YOUR_API_KEY_HERE") {
            setError("Please replace 'YOUR_API_KEY_HERE' in the code with your actual Gemini API key.");
            return;
        }
        if (!inputText.trim()) {
            setError('Please paste text or upload a file to analyze.');
            return;
        }

        setIsLoading(true);
        setError('');
        setAnalysisResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });

            const prompt = `
                Analyze the following research paper text for plagiarism. Your entire response MUST be a single, valid JSON object and nothing else.
                The JSON object must start with { and end with }. Do not include any introductory text, closing remarks, or markdown formatting like \`\`\`json.

                Generate the "analysis" and "recommendation" text in the following language: ${reportLanguage}.

                The JSON object must contain these exact keys:
                1. "analysis": (string) A detailed summary of the findings, in the specified language.
                2. "duplicationScore": (number) A value between 0 and 100 for the duplication percentage.
                3. "recommendation": (string) Must be one of: "Acceptable", "Minor Revisions Recommended", or "Major Revisions Required", translated into the specified language.
                4. "sources": (array) An array of source objects found via Google Search. Each object must have "title" (string) and "uri" (string) keys. If no sources are found, this must be an empty array [].

                Text to analyze:
                ---
                ${inputText}
                ---
            `;

            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            const responseText = result.text.trim();
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}');

            if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
                throw new Error("The API response did not contain a valid JSON object.");
            }

            const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
            const parsedResult = JSON.parse(jsonString);
            
            if (parsedResult.sources) {
                parsedResult.sources = parsedResult.sources.map(source => {
                    try {
                        const url = new URL(source.uri);
                        return { ...source, favicon: `${url.protocol}//${url.hostname}/favicon.ico` };
                    } catch {
                        return { ...source, favicon: null };
                    }
                });
            }
            
            setAnalysisResult(parsedResult);

        } catch (e) {
            console.error(e);
            const errorMessage = e.message.toLowerCase();
            
            if (errorMessage.includes('api key not valid') || errorMessage.includes('invalid api key')) {
                setError('Invalid API Key. Please check your key and try again.');
            } else if (e instanceof TypeError && errorMessage.includes('failed to fetch')) {
                setError('Network error. Please check your internet connection and try again.');
            } else if (errorMessage.includes('blocked')) {
                setError('The request was blocked due to safety settings. Please try modifying the input text.');
            }
            else {
                setError(`An unexpected error occurred: ${e.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestRevisions = async () => {
        if (API_KEY === "YOUR_API_KEY_HERE") {
            setRevisionError("Please replace 'YOUR_API_KEY_HERE' in the code with your actual Gemini API key.");
            setIsRevisionModalOpen(true);
            setIsRevising(false);
            return;
        }

        setIsRevisionModalOpen(true);
        setIsRevising(true);
        setRevisionError('');
        setRevisionSuggestions('');

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });

            const prompt = `
                Based on the original text provided below and its plagiarism analysis, your task is to act as a writing assistant.
                Identify the key sentences or paragraphs that are likely unoriginal and suggest how to rewrite them.
                Preserve the core meaning but ensure the new version is original.
                Present your response as a clear, well-formatted text. Use markdown for headings and lists if it improves readability.
                Your entire response should be in ${reportLanguage}.

                Original Text:
                ---
                ${inputText}
                ---

                Plagiarism Analysis Summary:
                ---
                ${analysisResult.analysis}
                ---
            `;

            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            setRevisionSuggestions(result.text);

        } catch (e) {
            console.error(e);
            setRevisionError(`Failed to generate suggestions: ${e.message}`);
        } finally {
            setIsRevising(false);
        }
    };


    const handleExportReport = () => {
        if (!analysisResult) return;
        const { analysis, duplicationScore, recommendation, sources } = analysisResult;
        
        let reportContent = `Research Plagiarism Detector - Analysis Report\n`;
        reportContent += `=================================================\n\n`;
        reportContent += `DUPLICATION SCORE: ${duplicationScore}%\n`;
        reportContent += `RECOMMENDATION: ${recommendation}\n\n`;
        reportContent += `--- ANALYSIS ---\n${analysis}\n\n`;
        reportContent += `--- POTENTIAL SOURCES ---\n`;
        if (sources && sources.length > 0) {
            sources.forEach(source => {
                reportContent += `- ${source.title}: ${source.uri}\n`;
            });
        } else {
            reportContent += `No potential sources found.\n`;
        }

        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plagiarism_report.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getRecommendationClass = (recommendation) => {
        if (!recommendation) return '';
        const rec = recommendation.toLowerCase();
        // Use English keywords as a fallback for classification, as the API might translate them.
        if (rec.includes('major') || rec.includes('गंभीर') || rec.includes('重大') || rec.includes('серьезные')) return 'major';
        if (rec.includes('minor') || rec.includes('मामूली') || rec.includes('次要') || rec.includes('незначительные')) return 'minor';
        return 'acceptable';
    };

    const RecommendationIcon = ({ recommendation }) => {
        const recClass = getRecommendationClass(recommendation);
        switch(recClass) {
            case 'major': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
            case 'minor': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
            case 'acceptable': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
            default: return null;
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                    <h1>Research Plagiarism Detector</h1>
                </div>
            </header>
            
            {isLoading && <div className="progress-bar"></div>}

            <main className="main-content">
                <div className="panel input-panel">
                    <div className="tabs">
                        <button className={`tab ${activeTab === 'paste' ? 'active' : ''}`} onClick={() => handleTabChange('paste')}>
                            Paste Text
                        </button>
                        <button className={`tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => handleTabChange('upload')}>
                            Upload File
                        </button>
                    </div>

                    {activeTab === 'paste' ? (
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Paste the content of the research paper here..."
                            className="text-input"
                            aria-label="Paste text here"
                        />
                    ) : (
                        <div 
                            className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input type="file" id="file-upload" accept=".pdf,.txt" onChange={handleFileChange} className="file-input" />
                            <label htmlFor="file-upload" className="dropzone-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                {fileName ? <strong>{fileName}</strong> : <span><strong>Choose a file</strong> or drag it here.</span>}
                                <span className="dropzone-supported">Supports: PDF, TXT</span>
                            </label>
                        </div>
                    )}
                    
                    <div className="input-actions">
                        <div className="language-selector">
                            <label htmlFor="language-select">Report Language:</label>
                            <select
                                id="language-select"
                                value={reportLanguage}
                                onChange={(e) => setReportLanguage(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="English">English</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Hinglish">Hinglish</option>
                                <option value="Chinese">Chinese</option>
                                <option value="Russian">Russian</option>
                            </select>
                        </div>
                        <button className="check-button" onClick={handleCheckDuplicacy} disabled={isLoading}>
                            {isLoading ? 'Analyzing...' : 'Check for Duplicacy'}
                        </button>
                    </div>
                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="panel output-panel">
                    {!analysisResult && !isLoading && !error && (
                        <div className="placeholder">
                             <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                            <h2>Analysis Report</h2>
                            <p>Your analysis report will appear here once you submit a document.</p>
                        </div>
                    )}
                    
                     {isLoading && !analysisResult && (
                        <div className="placeholder loading">
                            <svg className="spinner" viewBox="0 0 50 50"><circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle></svg>
                            <h2>Analyzing Document</h2>
                            <p>This may take a moment. Please wait...</p>
                        </div>
                    )}

                    {analysisResult && (
                         <div className="results-container">
                            <div className="results-header">
                                <h2>Analysis Report</h2>
                                <button className="export-button" onClick={handleExportReport}>
                                    Export Report
                                </button>
                            </div>
                            
                            <div className={`summary-card ${getRecommendationClass(analysisResult.recommendation)}`}>
                                <div className="progress-gauge" style={{ '--progress-value': `${analysisResult.duplicationScore}%` }}>
                                    <div className="gauge-value">{analysisResult.duplicationScore}<small>%</small></div>
                                </div>
                                <div className="recommendation">
                                    <RecommendationIcon recommendation={analysisResult.recommendation}/>
                                    <span>{analysisResult.recommendation}</span>
                                </div>
                            </div>
                            
                            <div className="analysis-header">
                                <h3>Detailed Analysis</h3>
                                {getRecommendationClass(analysisResult.recommendation) !== 'acceptable' && (
                                     <button className="revise-button" onClick={handleSuggestRevisions} disabled={isRevising}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.126c.417-.083.843-.126 1.282-.126 1.838 0 3.53.5 5 1.365a4.6 4.6 0 0 1 4.135 4.135C21.5 10.47 22 12.162 22 14c0 1.282-.126 2.583-.635 3.874M16.5 22c-1.838 0-3.53-.5-5-1.365a4.6 4.6 0 0 1-4.135-4.135C5.5 13.53 5 11.838 5 10c0-1.282.126-2.583.635-3.874"/><path d="m14 6-2-2-2 2"/><path d="m10 18 2 2 2-2"/></svg>
                                        Suggest Revisions
                                    </button>
                                )}
                            </div>
                            <p className="analysis-text">{analysisResult.analysis}</p>

                            <h3>Potential Sources</h3>
                            <div className="sources-list">
                                {analysisResult.sources && analysisResult.sources.length > 0 ? analysisResult.sources.map((source, index) => (
                                    <a 
                                      href={source.uri} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="source-card" 
                                      key={index}
                                      style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <img src={source.favicon || `https://www.google.com/s2/favicons?domain=${source.uri}`} alt="" className="favicon" onError={(e) => e.target.style.display='none'}/>
                                        <span className="source-title">{source.title}</span>
                                        <svg className="external-link-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                )) : <p>No potential online sources found.</p>}
                            </div>
                         </div>
                    )}
                </div>
            </main>

            {isRevisionModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>AI Revision Assistant</h3>
                            <button className="modal-close-button" onClick={() => setIsRevisionModalOpen(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            {isRevising && (
                                <div className="placeholder loading">
                                    <svg className="spinner" viewBox="0 0 50 50"><circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle></svg>
                                    <p>Generating suggestions...</p>
                                </div>
                            )}
                            {revisionError && <div className="error-message">{revisionError}</div>}
                            {!isRevising && revisionSuggestions && (
                                <div className="analysis-text">{revisionSuggestions}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<React.StrictMode><App /></React.StrictMode>);
}