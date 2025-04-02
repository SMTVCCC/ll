document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    const chatContainer = document.querySelector('.chat-container');
    const settingsBtn = document.getElementById('settingsBtn');
    
    // 隐藏设置按钮
    settingsBtn.style.display = 'none';
    
    // 在全局作用域声明变量，方便在不同函数间共享
    let isWaitingForResponse = false; // 标记是否正在等待AI响应
    let currentResponseElement = null; // 跟踪当前响应元素
    
    // 初始化欢迎消息状态
    const welcomeMessage = document.querySelector('.assistant-message');
    if (welcomeMessage) {
        welcomeMessage.dataset.complete = 'true';
    }
    
    // 添加发送按钮点击事件
    sendButton.addEventListener('click', () => {
        sendMessage();
    });
    
    // 添加回车发送功能
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });
    
    // 初始化星火API配置，创建全局sparkAPI对象
    initSparkAPI();
    
    // 设置API回调
    setupSparkApi();
    
    // 初始化星火API配置
    function initSparkAPI() {
        // 从.env文件中获取配置
        const appId = '3993bebc';
        const apiKey = 'b1ac6aed76cef76575745f348445afdc';
        const apiSecret = 'MGJhNmNhNThlNzQyZmM5MTY5OTRlZjZl';
        const uid = 'SMTLITE';
        const url = 'wss://spark-api.xf-yun.com/v1.1/chat';
        const domain = 'lite';
        
        console.log('正在初始化星火API...');
        
        // 初始化星火API
        window.sparkAPI = {
            ws: null,
            appId: appId,
            apiKey: apiKey,
            apiSecret: apiSecret,
            uid: uid,
            url: url,
            domain: domain,
            responseCallback: null,
            messageBuffer: '', // 添加消息缓冲区
            isFirstConnect: true, // 新增标记，用于跟踪是否是首次连接
            connectionAttempts: 0, // 连接尝试次数
            maxConnectionAttempts: 3, // 最大连接尝试次数
            
            // 设置响应回调函数
            setResponseCallback(callback) {
                this.responseCallback = callback;
            },
            
            // 生成认证URL
            generateAuthUrl() {
                try {
                    const date = new Date().toGMTString();
                    const signatureOrigin = `host: spark-api.xf-yun.com\ndate: ${date}\nGET /v1.1/chat HTTP/1.1`;
                    
                    // 确保CryptoJS已加载
                    if (typeof CryptoJS === 'undefined') {
                        console.error('CryptoJS未加载');
                        throw new Error('CryptoJS未加载，请检查加密库是否正确引入');
                    }
                    
                    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.apiSecret);
                    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
                    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
                    const authorization = btoa(authorizationOrigin);
                    
                    return `${this.url}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=spark-api.xf-yun.com`;
                } catch (error) {
                    console.error('生成认证URL时出错:', error);
                    return null;
                }
            },
            
            // 连接WebSocket
            async connect(silent = false) {
                // 如果已经有连接且状态正常，则不需要重新连接
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    console.log('WebSocket已连接，无需重新连接');
                    return true;
                }
                
                // 超过最大尝试次数
                if (this.connectionAttempts >= this.maxConnectionAttempts) {
                    console.error(`已尝试连接${this.connectionAttempts}次，放弃连接`);
                    if (!silent && this.responseCallback) {
                        this.responseCallback('无法连接到服务器，请检查网络连接或稍后再试', 'error');
                    }
                    return false;
                }
                
                this.connectionAttempts++;
                console.log(`尝试连接 #${this.connectionAttempts}`);
                
                // 关闭现有连接
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                
                try {
                    const url = this.generateAuthUrl();
                    if (!url) {
                        throw new Error('生成认证URL失败');
                    }
                    
                    console.log('正在连接到WebSocket...');
                    this.ws = new WebSocket(url);
                    
                    // 等待连接打开或失败
                    const connectionPromise = new Promise((resolve) => {
                        this.ws.onopen = () => {
                            console.log('WebSocket连接已建立');
                            this.isFirstConnect = false; // 连接成功后更新标记
                            this.connectionAttempts = 0; // 重置连接尝试次数
                            resolve(true);
                        };
                        
                        this.ws.onerror = (error) => {
                            console.error('WebSocket错误:', error);
                            if (!silent && this.responseCallback) {
                                this.responseCallback('连接星火API时出现错误，请稍后再试', 'error');
                            }
                            resolve(false);
                        };
                        
                        this.ws.onclose = () => {
                            console.log('WebSocket连接已关闭');
                            resolve(false);
                        };
                        
                        this.ws.onmessage = (event) => {
                            try {
                                const response = JSON.parse(event.data);
                                this.handleResponse(response);
                            } catch (error) {
                                console.error('解析响应失败:', error);
                                if (!silent && this.responseCallback) {
                                    this.responseCallback('抱歉，处理响应时出现错误', 'error');
                                }
                            }
                        };
                        
                        // 设置超时
                        setTimeout(() => {
                            if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                                console.log('WebSocket连接超时');
                                resolve(false);
                            }
                        }, 5000); // 5秒超时
                    });
                    
                    const connected = await connectionPromise;
                    return connected;
                    
                } catch (error) {
                    console.error('创建WebSocket连接失败:', error);
                    if (!silent && this.responseCallback) {
                        this.responseCallback('无法连接到星火API，请检查网络连接', 'error');
                    }
                    return false;
                }
            },
            
            // 处理API响应
            handleResponse(response) {
                if (!response || !response.header) {
                    console.error('收到无效响应:', response);
                    if (this.responseCallback) {
                        this.responseCallback('收到无效响应', 'error');
                    }
                    return;
                }
                
                if (response.header.code !== 0) {
                    console.error('API错误:', response.header.message);
                    if (this.responseCallback) {
                        this.responseCallback(`API错误: ${response.header.message}`, 'error');
                    }
                    return;
                }
                
                // 检查是否有文本内容
                if (response.payload && response.payload.choices && response.payload.choices.text && response.payload.choices.text.length > 0) {
                    const content = response.payload.choices.text[0].content;
                    
                    // 将新内容添加到缓冲区
                    this.messageBuffer += content;
                    
                    // 检查会话状态
                    const status = response.payload.choices.status;
                    
                    // 每次收到新的内容都更新消息，实现持续生成效果
                    if (this.responseCallback && this.messageBuffer) {
                        // 传递完整的缓冲区内容和完成状态
                        this.responseCallback(this.messageBuffer, 'assistant', status === 2);
                    }
                    
                    // 如果会话结束，清空缓冲区
                    if (status === 2) {
                        this.messageBuffer = '';
                    }
                }
            },
            
            // 发送消息到API
            async sendMessage(message) {
                // 清空消息缓冲区
                this.messageBuffer = '';
                
                // 确保WebSocket连接已建立
                if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    console.log('WebSocket未连接，尝试连接...');
                    const connected = await this.connect();
                    if (!connected) {
                        if (this.responseCallback) {
                            this.responseCallback('发送消息失败，请稍后再试', 'error');
                        }
                        return;
                    }
                }
                
                const data = {
                    header: {
                        app_id: this.appId,
                        uid: this.uid
                    },
                    parameter: {
                        chat: {
                            domain: this.domain,
                            temperature: 0.5,
                            max_tokens: 2048
                        }
                    },
                    payload: {
                        message: {
                            text: [{ role: 'user', content: message }]
                        }
                    }
                };
                
                try {
                    console.log('发送消息到API:', message);
                    this.ws.send(JSON.stringify(data));
                } catch (error) {
                    console.error('发送消息失败:', error);
                    
                    // 尝试重新连接并发送
                    console.log('尝试重新连接...');
                    const reconnected = await this.connect();
                    if (reconnected) {
                        try {
                            console.log('重新连接成功，重新发送消息');
                            this.ws.send(JSON.stringify(data));
                            return;
                        } catch (e) {
                            console.error('重试发送消息失败:', e);
                        }
                    }
                    
                    if (this.responseCallback) {
                        this.responseCallback('发送消息失败，请稍后再试', 'error');
                    }
                }
            }
        };
        
        // 初始化时预先连接WebSocket，但不显示错误
        console.log('尝试预连接WebSocket...');
        window.sparkAPI.connect(true).then(connected => {
            if (connected) {
                console.log('WebSocket预连接成功');
            } else {
                console.log('WebSocket预连接失败，将在用户发送消息时重试');
            }
        });
        
        console.log('星火API配置已初始化');
    }
    
    // 设置API的回调函数
    function setupSparkApi() {
        window.sparkAPI.setResponseCallback((response, type, isComplete) => {
            // 移除所有"正在思考"消息
            document.querySelectorAll('.thinking-message').forEach(el => el.remove());
            
            console.log('收到 AI 响应:', response, '类型:', type, '是否完成:', isComplete);
            
            if (!response) {
                console.error('收到空响应');
                return;
            }
            
            // 如果是错误消息，直接创建新的消息元素
            if (type === 'error') {
                createMessageElement(response, type);
                isWaitingForResponse = false; // 重置状态
                currentResponseElement = null; // 重置当前响应元素
            } else if (type === 'assistant') {
                // 替换回复中的特定词汇
                const processedResponse = replaceRestrictedTerms(response);
                console.log('处理后的响应:', processedResponse); // 添加日志
                
                // 如果没有当前响应元素，创建一个新的
                if (!currentResponseElement) {
                    currentResponseElement = createMessageElement(processedResponse, type);
                    currentResponseElement.dataset.complete = isComplete ? 'true' : 'false';
                } else {
                    // 更新现有消息内容
                    const contentDiv = currentResponseElement.querySelector('.message-content');
                    if (contentDiv) {
                        // 确保在这里也使用格式化后的文本
                        contentDiv.innerHTML = formatMessage(processedResponse);
                    }
                    currentResponseElement.dataset.complete = isComplete ? 'true' : 'false';
                }
                
                // 如果响应完成，重置状态
                if (isComplete) {
                    isWaitingForResponse = false;
                    currentResponseElement = null;
                    
                    // 添加语法高亮
                    document.querySelectorAll('pre code').forEach(block => {
                        highlightCodeBlock(block);
                    });
                }
            }
            
            // 滚动到底部
            scrollToBottom();
        });
    }
    
    // 格式化消息，支持Markdown风格的格式
    function formatMessage(text) {
        if (!text) return '';
        
        // 转义HTML特殊字符
        let formattedText = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // 处理代码块 (```code```)
        formattedText = formattedText.replace(/```([\s\S]*?)```/g, function(match, code) {
            // 检测语言
            const firstLine = code.trim().split('\n')[0];
            let language = '';
            let codeContent = code;
            
            if (firstLine && !firstLine.includes(' ') && firstLine.length < 20) {
                language = firstLine;
                codeContent = code.substring(firstLine.length).trim();
            }
            
            // 生成唯一ID用于复制功能
            const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
            
            // 预处理代码内容，保留换行和空格
            const processedCode = codeContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            return `
            <div class="code-block-wrapper">
                <div class="code-header">
                    <div class="code-language">
                        <button class="code-language-toggle">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        ${language || 'text'}
                    </div>
                    <button class="copy-button" onclick="copyCode('${codeId}')">
                        <i class="fas fa-copy"></i> 复制
                    </button>
                </div>
                <div class="code-container">
                    <div class="line-numbers" id="line-numbers-${codeId}"></div>
                    <pre class="language-${language}"><code id="${codeId}" class="language-${language}">${processedCode}</code></pre>
                </div>
            </div>`;
        });
        
        // 处理行内代码 (`code`)
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-pink-600 px-1 rounded font-mono">$1</code>');
        
        // 处理粗体 (**text**)
        formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
        
        // 处理斜体 (*text*)
        formattedText = formattedText.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
        
        // 处理标题 (# text)
        formattedText = formattedText.replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold my-2">$1</h1>');
        formattedText = formattedText.replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold my-2">$1</h2>');
        formattedText = formattedText.replace(/^### (.*$)/gm, '<h3 class="text-md font-bold my-2">$1</h3>');
        
        // 处理列表 (- item)
        formattedText = formattedText.replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>');
        
        // 处理换行，但保持代码块内的格式
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        return formattedText;
    }
    
    // 高亮代码块
    function highlightCodeBlock(block) {
        const codeId = block.id;
        const lineNumbersId = 'line-numbers-' + codeId;
        const lineNumbersElement = document.getElementById(lineNumbersId);
        
        if (!lineNumbersElement) return;
        
        // 获取代码内容
        const codeContent = block.textContent;
        
        // 分割成行
        const lines = codeContent.split('\n');
        let lineNumbers = '';
        let formattedCode = '';
        
        // 为每行添加行号和高亮
        lines.forEach((line, index) => {
            // 添加行号
            lineNumbers += `<span class="line-number">${index + 1}</span>`;
            
            // 添加语法高亮
            let highlightedLine = line;
            
            // 根据代码语言进行简单的语法高亮
            const language = block.className.replace('language-', '');
            
            if (language === 'python') {
                // 处理Python语法
                highlightedLine = highlightPythonSyntax(line);
            } else if (language === 'javascript' || language === 'js') {
                // 处理JavaScript语法
                highlightedLine = highlightJsSyntax(line);
            } else if (language === 'html') {
                // 处理HTML语法
                highlightedLine = highlightHtmlSyntax(line);
            } else if (language === 'css') {
                // 处理CSS语法
                highlightedLine = highlightCssSyntax(line);
            }
            
            formattedCode += highlightedLine + '\n';
        });
        
        // 更新行号
        lineNumbersElement.innerHTML = lineNumbers;
        
        // 更新代码内容，保留HTML标签
        block.innerHTML = formattedCode;
        
        // 为折叠按钮添加事件监听
        const toggleButton = block.closest('.code-block-wrapper').querySelector('.code-language-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', function() {
                const codeContainer = block.closest('.code-container');
                if (codeContainer.style.display === 'none') {
                    codeContainer.style.display = 'flex';
                    toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                } else {
                    codeContainer.style.display = 'none';
                    toggleButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
                }
            });
        }
    }
    
    // Python语法高亮
    function highlightPythonSyntax(line) {
        // 替换关键字
        let highlightedLine = line
            // 导入语句
            .replace(/\b(import|from|as)\b/g, '<span class="token import">$1</span>')
            // 注释
            .replace(/(#.*$)/g, '<span class="token comment">$1</span>')
            // 数字
            .replace(/\b(\d+)\b/g, '<span class="token number">$1</span>')
            // 常见关键字
            .replace(/\b(def|class|if|else|elif|for|while|return|in|not|and|or|True|False|None)\b/g, 
                     '<span class="token keyword">$1</span>')
            // 字符串（简化处理）
            .replace(/(".*?")/g, '<span class="token string">$1</span>')
            .replace(/('.*?')/g, '<span class="token string">$1</span>')
            // 函数调用（简化处理）
            .replace(/(\w+)\(/g, '<span class="token function">$1</span>(');
        
        return highlightedLine;
    }
    
    // JavaScript语法高亮
    function highlightJsSyntax(line) {
        // 基本的JavaScript高亮逻辑
        let highlightedLine = line
            // 注释
            .replace(/(\/\/.*$)/g, '<span class="token comment">$1</span>')
            // 关键字
            .replace(/\b(var|let|const|function|return|if|else|for|while|switch|case|break|continue|new|this|class)\b/g, 
                     '<span class="token keyword">$1</span>')
            // 数字
            .replace(/\b(\d+)\b/g, '<span class="token number">$1</span>')
            // 字符串
            .replace(/(".*?")/g, '<span class="token string">$1</span>')
            .replace(/('.*?')/g, '<span class="token string">$1</span>');
        
        return highlightedLine;
    }
    
    // HTML语法高亮（简化版）
    function highlightHtmlSyntax(line) {
        return line;
    }
    
    // CSS语法高亮（简化版）
    function highlightCssSyntax(line) {
        return line;
    }
    
    // 替换回复中的特定词汇
    function replaceRestrictedTerms(text) {
        if (!text) return text;
        
        const replacements = [
            // 模型相关
            { pattern: /星火认知大模型/gi, replacement: 'Smitty' },
            { pattern: /讯飞星火认知大模型/gi, replacement: 'Smitty' },
            { pattern: /星火大模型/gi, replacement: 'Smitty' },
            { pattern: /讯飞大模型/gi, replacement: 'Smitty' },
            { pattern: /讯飞模型/gi, replacement: 'Smitty' },
            { pattern: /星火模型/gi, replacement: 'Smitty' },
            { pattern: /讯飞/gi, replacement: 'Smitty' },
            { pattern: /星火/gi, replacement: 'Smitty' },
            
            // 自称相关
            { pattern: /我是一个\s*AI\s*助手/gi, replacement: '我是Smitty' },
            { pattern: /我是\s*AI\s*助手/gi, replacement: '我是Smitty' },
            { pattern: /我是人工智能助手/gi, replacement: '我是Smitty' },
            { pattern: /我是智能助手/gi, replacement: '我是Smitty' },
            { pattern: /我是语言模型/gi, replacement: '我是Smitty' },
            { pattern: /我是大语言模型/gi, replacement: '我是Smitty' },
            
            // 品牌和产品名称
            { pattern: /Claude/gi, replacement: 'Smitty' },
            { pattern: /Anthropic/gi, replacement: 'Smitty' },
            { pattern: /DeepSeek/gi, replacement: 'Smitty' },
            { pattern: /OpenAI/gi, replacement: 'Smitty' },
            { pattern: /ChatGPT/gi, replacement: 'Smitty' },
            { pattern: /GPT-4/gi, replacement: 'Smitty' },
            { pattern: /GPT-3/gi, replacement: 'Smitty' },
            { pattern: /GPT/gi, replacement: 'Smitty' },
            
            // 额外的变体
            { pattern: /科大讯飞/gi, replacement: 'Smitty' },
            { pattern: /讯飞星火/gi, replacement: 'Smitty' },
            { pattern: /iflytek/gi, replacement: 'Smitty' }
        ];
        
        let processedText = text;
        for (const rule of replacements) {
            processedText = processedText.replace(rule.pattern, rule.replacement);
        }
        
        console.log('原始文本:', text); // 添加日志
        console.log('处理后文本:', processedText); // 添加日志
        return processedText;
    }
    
    // 检查是否是身份相关问题
    function isIdentityQuestion(message) {
        const lowerMessage = message.toLowerCase();
        // 检查各种可能的身份问题模式
        const identityPatterns = [
            '你是谁', 'smt是谁', 'smitty是谁', '自我介绍', 
            '介绍一下你自己', '你叫什么名字', '你的名字是什么',
            '你是什么', '你是什么ai', '你是什么人工智能',
            'who are you', 'what are you', 'introduce yourself',
            'Smitty','smt','smitty','SMT','Smt'
        ];
        
        return identityPatterns.some(pattern => lowerMessage.includes(pattern));
    }
    
    // 根据用户问题生成身份回答
    function generateIdentityResponse(message) {
        const lowerMessage = message.toLowerCase();
        let name = "SMT";
        
        // 检查用户是否特别提到了Smitty
        if (lowerMessage.includes('smitty')) {
            name = "Smitty";
        }
        
        return `我是${name}，由Vincent创造出的AI智能体💗！`;
    }
    
    // 发送消息的函数
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // 创建用户消息
            createMessageElement(message, 'user');
            
            // 清空输入框
            messageInput.value = '';
            
            // 检查是否是身份相关问题
            if (isIdentityQuestion(message)) {
                // 直接回答身份问题，不请求API
                const identityResponse = generateIdentityResponse(message);
                createMessageElement(identityResponse, 'assistant');
                scrollToBottom();
            } else {
                // 正常流程，请求API回答
                // 重置状态
                isWaitingForResponse = true;
                currentResponseElement = null;
                
                // 添加"正在思考"提示
                createThinkingMessage();
                
                // 发送消息到API
                console.log('发送用户消息到API:', message);
                window.sparkAPI.sendMessage(message)
                    .catch(error => {
                        console.error('发送消息过程中出错:', error);
                        createMessageElement('发送消息失败，请检查网络连接或稍后再试', 'error');
                        isWaitingForResponse = false;
                    });
            }
            
            // 滚动到底部
            scrollToBottom();
        }
    }
    
    // 创建消息元素
    function createMessageElement(content, type) {
        let messageClass, iconSpan, nameSpan, textClass;
        
        switch(type) {
            case 'error':
                messageClass = 'bg-gradient-to-r from-red-100 to-red-50 rounded-2xl p-4 shadow-lg border-2 border-red-200';
                iconSpan = '<span class="mr-2">⚠️</span>';
                nameSpan = '<span class="text-sm font-medium text-red-600">系统提示</span>';
                textClass = 'text-sm text-red-600';
                break;
            case 'system':
                messageClass = 'bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl p-4 shadow-lg border-2 border-gray-200';
                iconSpan = '<span class="mr-2">🔔</span>';
                nameSpan = '<span class="text-sm font-medium text-gray-600">系统提示</span>';
                textClass = 'text-sm text-gray-600';
                break;
            case 'user':
                messageClass = 'bg-gradient-to-r from-cyan-100 to-pink-100 rounded-2xl p-4 shadow-lg border-2 border-cyan-200';
                iconSpan = '<span class="mr-2">👤</span>';
                nameSpan = '<span class="text-sm font-medium text-cyan-600">我</span>';
                textClass = 'text-sm text-cyan-600';
                break;
            case 'assistant':
            default:
                messageClass = 'bg-gradient-to-r from-pink-100 to-cyan-100 rounded-2xl p-4 shadow-lg border-2 border-pink-200 assistant-message';
                iconSpan = '<span class="mr-2">🍬</span>';
                nameSpan = '<span class="text-sm font-medium text-pink-600">Smitty</span>';
                textClass = 'text-sm text-pink-600';
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = messageClass;
        
        // 创建消息头部（图标和名称）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-center mb-2';
        headerDiv.innerHTML = `${iconSpan}${nameSpan}`;
        messageElement.appendChild(headerDiv);
        
        // 创建消息内容
        const contentDiv = document.createElement('div');
        contentDiv.className = `${textClass} message-content`;
        
        // 根据消息类型处理内容
        if (type === 'assistant') {
            contentDiv.innerHTML = formatMessage(content);
        } else {
            // 用户消息和系统消息只需要简单的文本处理
            contentDiv.textContent = content;
        }
        
        messageElement.appendChild(contentDiv);
        chatContainer.appendChild(messageElement);
        
        return messageElement;
    }
    
    // 创建"正在思考"提示
    function createThinkingMessage() {
        const thinkingMessage = document.createElement('div');
        thinkingMessage.className = 'bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl p-4 shadow-lg border-2 border-gray-200 thinking-message';
        thinkingMessage.innerHTML = `
            <div class="flex items-center mb-2">
                <span class="mr-2">🤔</span>
                <span class="text-sm font-medium text-gray-600">转脑筋～</span>
            </div>
            <p class="text-sm text-gray-600">Smitty要好好思考一下...</p>
        `;
        chatContainer.appendChild(thinkingMessage);
    }
    
    // 显示提示消息
    function showToast(message) {
        // 移除现有的toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }
        
        // 创建新的toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 触发重绘以应用过渡效果
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 设置自动消失
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }
    
    // 滚动到底部
    function scrollToBottom() {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }
    
    // 复制代码函数 - 在HTML中定义为全局函数
    window.copyCode = function(codeId) {
        const codeElement = document.getElementById(codeId);
        const codeText = codeElement.textContent;
        
        // 创建临时textarea元素
        const textarea = document.createElement('textarea');
        textarea.value = codeText;
        document.body.appendChild(textarea);
        
        // 选择并复制
        textarea.select();
        document.execCommand('copy');
        
        // 移除临时元素
        document.body.removeChild(textarea);
        
        // 显示复制成功提示
        showToast('代码已复制到剪贴板');
    };
});