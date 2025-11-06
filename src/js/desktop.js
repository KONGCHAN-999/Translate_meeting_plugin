(function () {
  'use strict';

  // Configuration - Update these field codes to match your Kintone app
  const CONFIG = {
    transcriptField: 'transcript',    
    translationField: 'translation',  
    summaryField: 'summary',          
    buttonSpace: 'button_space',      
    apiKey: '52c85985a8784811bbb081237bb63814',
    translationApiKey: 'YOUR_GOOGLE_TRANSLATE_API_KEY', 
    openaiApiKey: 'YOUR_OPENAI_API_KEY',             
    languageCode: 'ja',               
    autoDetectLanguage: true,         
    useGoogleTranslate: true          
  };

  let audioBlob = null;
  let audioFileName = '';
  let transcriptText = '';
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingStream = null;

  // Trigger on "Create Record" page
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function (event) {
    if (document.getElementById('audioContainer')) return event;

    // Create container
    const container = document.createElement('div');
    container.id = 'audioContainer';
    container.style.cssText = 'padding: 15px; background: #f5f5f5; border-radius: 8px; margin: 10px 0;';

    // File input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,video/*';
    fileInput.id = 'audioFileInput';
    fileInput.style.display = 'none';

    // Upload button
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '📁 Upload Audio File';
    uploadBtn.className = 'kintoneplugin-button-dialog-ok';
    uploadBtn.type = 'button';
    uploadBtn.style.marginRight = '10px';
    uploadBtn.onclick = () => fileInput.click();

    // Record button
    const recordBtn = document.createElement('button');
    recordBtn.id = 'recordBtn';
    recordBtn.textContent = '🎤 Start Recording';
    recordBtn.className = 'kintoneplugin-button-dialog-ok';
    recordBtn.type = 'button';
    recordBtn.style.cssText = 'margin-right: 10px; background-color: #dc3545; color: white;';

    // Recording indicator
    const recordingIndicator = document.createElement('div');
    recordingIndicator.id = 'recordingIndicator';
    recordingIndicator.style.cssText = 'display: none; margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #dc3545; border-radius: 4px;';
    recordingIndicator.innerHTML = '🔴 <strong>Recording...</strong> <span id="recordingTime">00:00</span>';

    // Upload buttons container
    const uploadContainer = document.createElement('div');
    uploadContainer.style.cssText = 'margin-bottom: 10px;';
    uploadContainer.appendChild(uploadBtn);
    uploadContainer.appendChild(recordBtn);

    // Audio player (hidden initially)
    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.style.cssText = 'display: none; width: 100%; margin-top: 10px;';
    audioPlayer.id = 'audioPlayer';

    // Status text
    const statusText = document.createElement('div');
    statusText.style.cssText = 'margin-top: 10px; color: #666; font-size: 14px;';
    statusText.id = 'statusText';

    // Convert button (disabled initially)
    const convertBtn = document.createElement('button');
    convertBtn.id = 'convertBtn';
    convertBtn.textContent = '🎙️ Convert to Text';
    convertBtn.className = 'kintoneplugin-button-dialog-ok';
    convertBtn.type = 'button';
    convertBtn.disabled = true;
    convertBtn.style.cssText = 'margin-top: 15px; opacity: 0.5; margin-right: 10px;';

    // Translation button (disabled initially)
    const translateBtn = document.createElement('button');
    translateBtn.id = 'translateBtn';
    translateBtn.textContent = '🌐 Translate Text';
    translateBtn.className = 'kintoneplugin-button-dialog-ok';
    translateBtn.type = 'button';
    translateBtn.disabled = true;
    translateBtn.style.cssText = 'margin-top: 15px; opacity: 0.5; margin-right: 10px;';

    // AI Summary button (disabled initially)
    const summaryBtn = document.createElement('button');
    summaryBtn.id = 'summaryBtn';
    summaryBtn.textContent = '🤖 AI Meeting Summary';
    summaryBtn.className = 'kintoneplugin-button-dialog-ok';
    summaryBtn.type = 'button';
    summaryBtn.disabled = true;
    summaryBtn.style.cssText = 'margin-top: 15px; opacity: 0.5;';

    // Language selector
    const langContainer = document.createElement('div');
    langContainer.style.cssText = 'margin-top: 10px;';
    
    const langLabel = document.createElement('label');
    langLabel.textContent = 'Audio Language: ';
    langLabel.style.marginRight = '10px';
    
    const langSelect = document.createElement('select');
    langSelect.id = 'langSelect';
    langSelect.style.cssText = 'padding: 5px; border-radius: 4px; border: 1px solid #ccc;';
    langSelect.innerHTML = `
      <option value="auto">Auto-detect</option>
      <option value="en" selected>English</option>
      <option value="ja">Japanese (日本語)</option>
      <option value="zh">Chinese (中文)</option>
      <option value="es">Spanish (Español)</option>
      <option value="fr">French (Français)</option>
      <option value="de">German (Deutsch)</option>
      <option value="it">Italian (Italiano)</option>
      <option value="pt">Portuguese (Português)</option>
      <option value="nl">Dutch (Nederlands)</option>
      <option value="ko">Korean (한국어)</option>
      <option value="hi">Hindi (हिन्दी)</option>
      <option value="ar">Arabic (العربية)</option>
      <option value="ru">Russian (Русский)</option>
      <option value="th">Thai (ไทย)</option>
      <option value="vi">Vietnamese (Tiếng Việt)</option>
    `;
    
    langContainer.appendChild(langLabel);
    langContainer.appendChild(langSelect);

    // Translation language selector
    const transLangContainer = document.createElement('div');
    transLangContainer.style.cssText = 'margin-top: 10px;';
    
    const transLangLabel = document.createElement('label');
    transLangLabel.textContent = 'Translate to: ';
    transLangLabel.style.marginRight = '10px';
    
    const transLangSelect = document.createElement('select');
    transLangSelect.id = 'transLangSelect';
    transLangSelect.style.cssText = 'padding: 5px; border-radius: 4px; border: 1px solid #ccc;';
    transLangSelect.innerHTML = `
      <option value="EN">English</option>
      <option value="JA">Japanese (日本語)</option>
      <option value="ZH">Chinese Simplified (简体中文)</option>
      <option value="ES">Spanish (Español)</option>
      <option value="FR">French (Français)</option>
      <option value="DE">German (Deutsch)</option>
      <option value="IT">Italian (Italiano)</option>
      <option value="PT-PT">Portuguese (Português)</option>
      <option value="NL">Dutch (Nederlands)</option>
      <option value="KO">Korean (한국어)</option>
      <option value="RU">Russian (Русский)</option>
      <option value="AR">Arabic (العربية)</option>
      <option value="ID">Indonesian (Bahasa Indonesia)</option>
      <option value="TR">Turkish (Türkçe)</option>
      <option value="PL">Polish (Polski)</option>
      <option value="UK">Ukrainian (Українська)</option>
      <option value="SV">Swedish (Svenska)</option>
      <option value="DA">Danish (Dansk)</option>
      <option value="FI">Finnish (Suomi)</option>
      <option value="NO">Norwegian (Norsk)</option>
    `;
    
    transLangContainer.appendChild(transLangLabel);
    transLangContainer.appendChild(transLangSelect);

    // File size info
    const fileSizeInfo = document.createElement('div');
    fileSizeInfo.id = 'fileSizeInfo';
    fileSizeInfo.style.cssText = 'margin-top: 5px; font-size: 12px; color: #666;';

    // Buttons container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'margin-top: 15px;';
    btnContainer.appendChild(convertBtn);
    btnContainer.appendChild(translateBtn);
    btnContainer.appendChild(summaryBtn);

    // Assemble container
    container.appendChild(fileInput);
    container.appendChild(uploadContainer);
    container.appendChild(recordingIndicator);
    container.appendChild(audioPlayer);
    container.appendChild(langContainer);
    container.appendChild(transLangContainer);
    container.appendChild(fileSizeInfo);
    container.appendChild(statusText);
    container.appendChild(btnContainer);

    // Add to space field
    const space = kintone.app.record.getSpaceElement(CONFIG.buttonSpace);
    if (space) {
      space.appendChild(container);
    } else {
      console.warn('Button space not found. Add a blank space field with code: ' + CONFIG.buttonSpace);
    }

    // File input change handler
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        audioBlob = file;
        audioFileName = file.name;
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioPlayer.style.display = 'block';
        
        // Show file size
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        fileSizeInfo.textContent = `File size: ${sizeInMB} MB`;
        
        statusText.textContent = '✅ Audio file loaded: ' + file.name;
        statusText.style.color = '#28a745';
        convertBtn.disabled = false;
        convertBtn.style.opacity = '1';
      }
    };

    // Record button handler
    let recordingStartTime;
    let recordingTimer;

    recordBtn.onclick = async () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        // Stop recording
        mediaRecorder.stop();
        recordingStream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimer);
        
        recordBtn.textContent = '🎤 Start Recording';
        recordBtn.style.backgroundColor = '#dc3545';
        recordingIndicator.style.display = 'none';
        statusText.textContent = '⏳ Processing recording...';
        statusText.style.color = '#0066cc';
      } else {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            } 
          });
          
          recordingStream = stream;
          audioChunks = [];
          
          // Detect browser and use appropriate MIME type
          let mimeType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
          }
          
          mediaRecorder = new MediaRecorder(stream, { mimeType });
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const audioBlob_temp = new Blob(audioChunks, { type: mimeType });
            audioBlob = audioBlob_temp;
            audioFileName = `recording_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
            
            const url = URL.createObjectURL(audioBlob);
            audioPlayer.src = url;
            audioPlayer.style.display = 'block';
            
            const sizeInMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
            fileSizeInfo.textContent = `File size: ${sizeInMB} MB`;
            
            statusText.textContent = '✅ Recording saved successfully!';
            statusText.style.color = '#28a745';
            convertBtn.disabled = false;
            convertBtn.style.opacity = '1';
          };
          
          mediaRecorder.start(1000); // Collect data every second
          
          recordBtn.textContent = '⏹️ Stop Recording';
          recordBtn.style.backgroundColor = '#6c757d';
          recordingIndicator.style.display = 'block';
          statusText.textContent = '🎤 Recording in progress...';
          statusText.style.color = '#dc3545';
          
          // Start timer
          recordingStartTime = Date.now();
          recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
          }, 1000);
          
        } catch (error) {
          console.error('Microphone access error:', error);
          alert('❌ Cannot access microphone. Please allow microphone permission in your browser settings.');
          statusText.textContent = '❌ Microphone access denied';
          statusText.style.color = '#dc3545';
        }
      }
    };

    // Convert button handler
    convertBtn.onclick = async () => {
      if (!audioBlob) {
        alert('❌ Please upload audio first');
        return;
      }

      if (CONFIG.apiKey === 'YOUR_ASSEMBLYAI_API_KEY') {
        alert('❌ Please add your AssemblyAI API key in the CONFIG section.\n\nGet free API key at: https://www.assemblyai.com/dashboard/signup');
        return;
      }

      convertBtn.disabled = true;
      convertBtn.textContent = '⏳ Converting...';
      statusText.textContent = '⏳ Step 1/3: Uploading audio...';
      statusText.style.color = '#0066cc';

      try {
        // Get selected language
        const selectedLang = langSelect.value;
        
        // Step 1: Upload audio file
        const uploadUrl = await uploadAudioFile(audioBlob);
        statusText.textContent = '⏳ Step 2/3: Processing audio...';

        // Step 2: Request transcription
        const transcriptId = await requestTranscription(uploadUrl, selectedLang);
        statusText.textContent = '⏳ Step 3/3: Getting transcript (this may take a while)...';

        // Step 3: Poll for result
        const result = await pollTranscription(transcriptId);
        
        // Store transcript text for translation
        transcriptText = result.text;
        
        // Update Kintone field
        const currentRecord = kintone.app.record.get();
        let finalText = result.text;
        
        // Add detected language info if auto-detect was used
        if (selectedLang === 'auto' && result.language_code) {
          finalText = `[Detected: ${result.language_code}]\n\n${result.text}`;
        }
        
        currentRecord.record[CONFIG.transcriptField].value = finalText;
        kintone.app.record.set(currentRecord);

        // Show detailed stats
        const duration = result.audio_duration ? Math.round(result.audio_duration) + 's' : 'N/A';
        const words = result.words ? result.words.length : 'N/A';
        statusText.innerHTML = `✅ Completed! Duration: ${duration} | Words: ${words}`;
        statusText.style.color = '#28a745';

        // Enable translation button
        translateBtn.disabled = false;
        translateBtn.style.opacity = '1';
        
        // Enable AI summary button
        summaryBtn.disabled = false;
        summaryBtn.style.opacity = '1';

        alert('✅ Audio converted to text successfully!');

      } catch (error) {
        console.error('Error:', error);
        statusText.textContent = '❌ Error: ' + error.message;
        statusText.style.color = '#dc3545';
        alert('❌ Error: ' + error.message);
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = '🎙️ Convert to Text';
      }
    };

    // Translation button handler
    translateBtn.onclick = async () => {
      // Check if we have transcript text
      const currentRecord = kintone.app.record.get();
      const textToTranslate = transcriptText || currentRecord.record[CONFIG.transcriptField].value;

      // check if text is available
      if (!textToTranslate) {
        alert('❌ Please convert audio to text first');
        return;
      }

      if (CONFIG.translationApiKey === 'YOUR_DEEPL_API_KEY') {
        alert('❌ Please add your DeepL API key in the CONFIG section.\n\nGet free API key at: https://www.deepl.com/pro-api');
        return;
      }

      translateBtn.disabled = true;
      translateBtn.textContent = '⏳ Translating...';
      statusText.textContent = '⏳ Translating text...';
      statusText.style.color = '#0066cc';

      try {
        const targetLang = transLangSelect.value;
        const translatedText = await translateText(textToTranslate, targetLang);
        
        // Check if translation field exists in the record
        const hasTranslationField = CONFIG.translationField && 
                                   currentRecord.record.hasOwnProperty(CONFIG.translationField);
        
        if (hasTranslationField) {
          // Update separate translation field
          currentRecord.record[CONFIG.translationField].value = translatedText;
        } else {
          // Append to transcript field if translation field doesn't exist
          const combined = `${textToTranslate}\n\n--- Translation (${targetLang}) ---\n${translatedText}`;
          currentRecord.record[CONFIG.transcriptField].value = combined;
        }
        
        kintone.app.record.set(currentRecord);

        statusText.textContent = `✅ Translation completed to ${targetLang}!`;
        statusText.style.color = '#28a745';
        alert('✅ Text translated successfully!');

      } catch (error) {
        console.error('Translation error:', error);
        statusText.textContent = '❌ Translation error: ' + error.message;
        statusText.style.color = '#dc3545';
        alert('❌ Translation error: ' + error.message);
      } finally {
        translateBtn.disabled = false;
        translateBtn.textContent = '🌐 Translate Text';
      }
    };

    // AI Summary button handler
    summaryBtn.onclick = async () => {
      const currentRecord = kintone.app.record.get();
      const textToSummarize = transcriptText || currentRecord.record[CONFIG.transcriptField].value;
      
      if (!textToSummarize) {
        alert('❌ Please convert audio to text first');
        return;
      }

      if (CONFIG.openaiApiKey === 'YOUR_OPENAI_API_KEY') {
        alert('❌ Please add your OpenAI API key in the CONFIG section.\n\nGet API key at: https://platform.openai.com/api-keys');
        return;
      }

      summaryBtn.disabled = true;
      summaryBtn.textContent = '⏳ Generating Summary...';
      statusText.textContent = '⏳ AI is analyzing the meeting...';
      statusText.style.color = '#0066cc';

      try {
        const summary = await generateMeetingSummary(textToSummarize);
        
        // Check if summary field exists
        const hasSummaryField = CONFIG.summaryField && 
                               currentRecord.record.hasOwnProperty(CONFIG.summaryField);
        
        if (hasSummaryField) {
          // Update separate summary field
          currentRecord.record[CONFIG.summaryField].value = summary;
        } else {
          // Append to transcript field if summary field doesn't exist
          const combined = `${textToSummarize}\n\n--- AI Meeting Summary ---\n${summary}`;
          currentRecord.record[CONFIG.transcriptField].value = combined;
        }
        
        kintone.app.record.set(currentRecord);

        statusText.textContent = '✅ AI Meeting Summary generated!';
        statusText.style.color = '#28a745';
        alert('✅ Meeting summary created successfully!');

      } catch (error) {
        console.error('AI Summary error:', error);
        statusText.textContent = '❌ AI Summary error: ' + error.message;
        statusText.style.color = '#dc3545';
        alert('❌ AI Summary error: ' + error.message);
      } finally {
        summaryBtn.disabled = false;
        summaryBtn.textContent = '🤖 AI Meeting Summary';
      }
    };

    return event;
  });

  // Upload audio file to AssemblyAI
  async function uploadAudioFile(audioBlob) {
    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': CONFIG.apiKey
      },
      body: audioBlob
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error('Upload failed: ' + (error.error || response.statusText));
    }

    const data = await response.json();
    return data.upload_url;
  }

  // Request transcription
  async function requestTranscription(audioUrl, languageCode) {
    const requestBody = {
      audio_url: audioUrl
    };
    
    // Add language settings
    if (languageCode === 'auto') {
      requestBody.language_detection = true;
    } else {
      requestBody.language_code = languageCode;
    }
    
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': CONFIG.apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error('Transcription request failed: ' + (error.error || response.statusText));
    }

    const data = await response.json();
    return data.id;
  }

  // Poll for transcription result
  async function pollTranscription(transcriptId) {
    const checkStatus = async () => {
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        method: 'GET',
        headers: {
          'authorization': CONFIG.apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get transcription status');
      }

      return await response.json();
    };

    // Poll every 3 seconds until completed
    let attempts = 0;
    const maxAttempts = 200; // Max ~10 minutes
    
    while (attempts < maxAttempts) {
      const result = await checkStatus();
      
      if (result.status === 'completed') {
        return result; // Return full result object
      } else if (result.status === 'error') {
        throw new Error('Transcription failed: ' + result.error);
      }
      
      // Update progress if available
      const statusEl = document.getElementById('statusText');
      if (statusEl && result.status === 'processing') {
        statusEl.textContent = `⏳ Processing... (${Math.round(attempts * 3)}s elapsed)`;
      }
      
      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }
    
    throw new Error('Transcription timeout - file may be too large');
  }

  // Translate text using DeepL API
  async function translateText(text, targetLang) {
    // Remove language detection prefix if present
    const cleanText = text.replace(/^\[Detected: [a-z]{2}\]\n\n/, '');
    
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${CONFIG.translationApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        text: cleanText,
        target_lang: targetLang
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error('Translation failed: ' + (error.message || response.statusText));
    }

    const data = await response.json();
    return data.translations[0].text;
  }

  // Alternative: Translate using Google Translate API (if you prefer)
  async function translateTextGoogle(text, targetLang) {
    const apiKey = CONFIG.translationApiKey; // Use Google Cloud API key
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        target: targetLang.toLowerCase()
      })
    });

    if (!response.ok) {
      throw new Error('Translation failed: ' + response.statusText);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  }

  // Generate AI Meeting Summary using OpenAI
  async function generateMeetingSummary(transcript) {
    // Remove language detection prefix if present
    const cleanText = transcript.replace(/^\[Detected: [a-z]{2}\]\n\n/, '');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an expert meeting summarizer. Create clear, structured meeting summaries with key points, decisions, and action items.'
          },
          {
            role: 'user',
            content: `Please analyze this meeting transcript and create a comprehensive summary with the following sections:

1. **Meeting Overview** (2-3 sentences)
2. **Key Discussion Points** (bullet points)
3. **Decisions Made** (bullet points)
4. **Action Items** (bullet points with responsible parties if mentioned)
5. **Next Steps** (if applicable)

Transcript:
${cleanText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error('AI Summary failed: ' + (error.error?.message || response.statusText));
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Alternative: Generate summary using Anthropic Claude (if you prefer)
  async function generateMeetingSummaryAnthropic(transcript) {
    const cleanText = transcript.replace(/^\[Detected: [a-z]{2}\]\n\n/, '');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.openaiApiKey, // Use Anthropic API key
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast and efficient
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Please analyze this meeting transcript and create a comprehensive summary with the following sections:

1. **Meeting Overview** (2-3 sentences)
2. **Key Discussion Points** (bullet points)
3. **Decisions Made** (bullet points)
4. **Action Items** (bullet points with responsible parties if mentioned)
5. **Next Steps** (if applicable)

Transcript:
${cleanText}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error('AI Summary failed: ' + (error.error?.message || response.statusText));
    }

    const data = await response.json();
    return data.content[0].text;
  }

})();