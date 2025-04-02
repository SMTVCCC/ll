// DOM元素
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesList = document.getElementById('messages-list');
const welcomeMessage = document.getElementById('welcome-message');
const scrollToBottomButton = document.getElementById('scroll-to-bottom');
const conversationContainer = document.getElementById('conversation-container');
const thinkingChainToggle = document.getElementById('thinking-chain-toggle');
const thinkingModeStatus = document.getElementById('thinking-mode-status');
const sendIcon = document.getElementById('send-icon');
const loadingIcon = document.getElementById('loading-icon');
const messagesEnd = document.getElementById('messages-end');

// 状态变量
let messages = [];
let isThinkingChainMode = false;
let isLoading = false;
let lastScrollTop = 0; // 用于检测滚动方向
let isScrolling = false; // 滚动锁定
let touchStartY = 0; // 触摸开始点Y坐标

// 深度思考链模板
const thinkingChainTemplate = `
重点：若问题只需检点逻辑即可完成将可以不实用以下辅助推理逻辑链直接作答。
你是一个智商极高的逻辑数学教授，请你仔细分析题目，按照逻辑推理链步骤逐步推理

**逻辑推理链格式**

**1. 明确已知条件**
- 列出题目给出的所有信息和约束。

**2. 分解问题**
- 将复杂问题拆解为更小的子问题或步骤。

**3. 假设与验证**
- 提出可能的假设（如变量设定、逻辑分支）。
- 通过代入或排除法验证假设是否符合条件。

**4. 建立数学模型（适用于数学问题）**
- 定义变量，构建方程或不等式。
- 逐步求解并记录关键步骤。

**5. 逻辑推导（适用于逻辑谜题）**
- 使用逆否命题、矛盾法等逻辑工具。
- 穷举所有可能性，排除不符合条件的情况。

**6. 验证答案**
- 将结果代入原题条件，检查是否成立。
- 确认是否存在其他可能解。

**7. 总结结论**
- 用简明语言概括最终答案和推理路径。
`;

// 初始化
function init() {
  // 输入框事件监听
  messageInput.addEventListener('input', handleInputChange);
  
  // 发送按钮事件监听
  sendButton.addEventListener('click', handleSendMessage);
  
  // 按下Enter键发送消息
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // 滚动按钮事件监听
  scrollToBottomButton.addEventListener('click', scrollToBottom);
  
  // 滚动事件监听，使用防抖函数优化性能
  conversationContainer.addEventListener('scroll', debounce(handleScroll, 100));
  
  // 思考链模式切换事件监听
  thinkingChainToggle.addEventListener('click', toggleThinkingChainMode);
  
  // 更新思考链模式状态显示
  updateThinkingChainStatus();
  
  // 移动端触摸事件优化
  setupTouchEvents();
  
  // 在页面加载后启用暗黑模式（如果系统偏好设置为暗色）
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (e.matches) {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }
  });

  // 页面加载完成后聚焦输入框（延迟执行，避免移动端键盘自动弹出）
  setTimeout(() => {
    if (window.innerWidth > 768) { // 仅在非移动设备上自动聚焦
      messageInput.focus();
    }
  }, 500);
  
  // 将切换思考过程的函数暴露到全局作用域
  window.toggleThoughtProcess = toggleThoughtProcess;
}

// 设置触摸事件
function setupTouchEvents() {
  // 防止橡皮筋效果
  document.addEventListener('touchmove', (e) => {
    if (isScrolling) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 输入框触摸事件，优化在移动设备上的体验
  messageInput.addEventListener('touchstart', () => {
    // 输入框获得焦点时滚动到底部
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  });
  
  // 检测滑动方向来显示/隐藏滚动按钮
  conversationContainer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  
  conversationContainer.addEventListener('touchmove', debounce((e) => {
    const touchCurrentY = e.touches[0].clientY;
    const scrollDiff = touchStartY - touchCurrentY;
    
    // 向上滑动显示滚动到底部按钮
    if (scrollDiff > 20 && !isNearBottom()) {
      scrollToBottomButton.classList.remove('hidden');
    }
    
    // 向下滑动且接近底部时隐藏按钮
    if (scrollDiff < -20 && isNearBottom()) {
      scrollToBottomButton.classList.add('hidden');
    }
  }, 100), { passive: true });
}

// 检查是否接近底部
function isNearBottom() {
  const { scrollTop, scrollHeight, clientHeight } = conversationContainer;
  return scrollHeight - scrollTop - clientHeight < 100;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 处理输入变化
function handleInputChange() {
  const inputValue = messageInput.value.trim();
  sendButton.disabled = inputValue === '' || isLoading;
  
  // 自动调整textarea高度
  messageInput.style.height = 'auto';
  const maxHeight = window.innerWidth <= 768 ? 120 : 200; // 移动端和桌面端最大高度不同
  messageInput.style.height = Math.min(messageInput.scrollHeight, maxHeight) + 'px';
}

// 处理发送消息
async function handleSendMessage() {
  const inputValue = messageInput.value.trim();
  if (inputValue === '' || isLoading) return;
  
  // 添加用户消息
  addMessage({
    role: 'user',
    content: inputValue
  });
  
  // 清空输入框
  messageInput.value = '';
  handleInputChange();
  
  // 隐藏欢迎消息
  welcomeMessage.classList.add('hidden');
  
  // 设置加载状态
  setLoading(true);
  
  // 准备消息体
  let finalInput = inputValue;
  if (isThinkingChainMode) {
    finalInput = `${thinkingChainTemplate}\n\n用户问题: ${inputValue}`;
  }
  
  try {
    // 调用API获取回复
    const response = await callChatAPI(finalInput, isThinkingChainMode);
    
    // 如果是思考链模式，callChatAPI函数内部已经处理了消息添加
    // 只有在非思考链模式下才添加AI回复
    if (!isThinkingChainMode && response) {
    addMessage({
      role: 'assistant',
      content: response
    });
    }
  } catch (error) {
    console.error('获取AI回复时出错:', error);
    
    // 显示错误消息
    // 判断是否是在总结过程中发生的错误
    if (error.message && error.message.includes('总结')) {
      addMessage({
        role: 'assistant',
        content: `<div class="summary-container">
          <div class="summary-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="summary-icon">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>结论总结</span>
          </div>
          <div class="summary-content">
            <p>很抱歉，总结过程遇到了错误：${error.message}</p>
            <p>您可以查看上方的完整思考过程，或者重新提问。</p>
          </div>
        </div>`
      });
    } else {
      // 一般错误
    addMessage({
      role: 'assistant',
      content: `很抱歉，发生了错误：${error.message || '无法连接到服务器，请稍后再试。'}`
    });
    }
  } finally {
    // 重置加载状态
    setLoading(false);
  }
}

// 添加消息到UI
function addMessage(message) {
  // 添加到消息数组
  messages.push(message);
  
  // 创建消息元素
  const messageItem = document.createElement('div');
  messageItem.classList.add('message-item');
  
  const isUser = message.role === 'user';
  const isThinking = message.role === 'assistant-thinking';
  
  if (isUser) {
    messageItem.classList.add('user');
  }
  
  // 构建消息HTML
  let avatarHtml = '';
  if (!isUser) {
    avatarHtml = `
      <div class="avatar bot-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="avatar-icon ${isThinking ? 'thinking-animation' : ''}">
          <path d="M12 8V4H8"></path>
          <rect x="2" y="2" width="20" height="8" rx="2"></rect>
          <path d="M2 12h20"></path>
          <path d="M2 18h20"></path>
          <path d="M2 22h20"></path>
        </svg>
      </div>
    `;
  }
  
  let contentHtml = '';
  if (isUser) {
    contentHtml = `<p>${escapeHtml(message.content)}</p>`;
  } else if (isThinking) {
    contentHtml = `
      <div class="thinking-indicator">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
      </div>
      <p>${escapeHtml(message.content)}</p>
    `;
  } else {
    contentHtml = `<div class="markdown-content">${markdownToHtml(message.content)}</div>`;
  }
  
  messageItem.innerHTML = `
    ${!isUser ? avatarHtml : ''}
    <div class="message-content-wrapper">
      <div class="message-bubble ${isUser ? 'user-message' : isThinking ? 'thinking-message' : 'bot-message'}">
        ${contentHtml}
      </div>
      <span class="message-time">${isUser ? '您' : 'AI 助手'} · ${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</span>
    </div>
    ${isUser ? `
      <div class="avatar user-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="avatar-icon">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    ` : ''}
  `;
  
  // 将消息添加到列表
  messagesList.appendChild(messageItem);
  
  // 使用IntersectionObserver优化代码高亮
  if (!isUser && !isThinking) {
    lazyLoadSyntaxHighlighting(messageItem);
  }
  
  // 滚动到底部
  scrollToBottom();
}

// 懒加载语法高亮，提高性能
function lazyLoadSyntaxHighlighting(messageItem) {
  const codeBlocks = messageItem.querySelectorAll('pre code');
  if (codeBlocks.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          hljs.highlightElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    codeBlocks.forEach(block => {
      observer.observe(block);
    });
  }
}

// 将Markdown转换为HTML
function markdownToHtml(markdown) {
  // 使用marked库处理Markdown
  const html = marked.parse(markdown);
  
  return formatThinkingChain(html);
}

// 格式化思考链内容
function formatThinkingChain(content) {
  // 检查内容中是否包含思考过程和总结
  if (content.includes('<div class="thought-process-container">')) {
    // 内容已经包含思考过程和总结的标记，直接返回
    return content;
  }
  
  // 常规思考链格式化
  return content
    .replace(/\*\*深度思考推理链格式\*\*/g, '<span class="thinking-chain-header">**深度思考推理链格式**</span>')
    .replace(/\*\*(\d+\.\s[^*]+)\*\*/g, '<span class="thinking-chain-section">**$1**</span>')
    .replace(/L(\d)(\s\w+[：:：]?)/g, '<span class="thinking-chain-level thinking-chain-level-$1">L$1</span>$2')
    .replace(/核心问题：/g, '<strong>核心问题：</strong>')
    .replace(/问题边界：/g, '<strong>问题边界：</strong>')
    .replace(/利益相关者：/g, '<strong>利益相关者：</strong>')
    .replace(/当前矛盾点：/g, '<strong>当前矛盾点：</strong>')
    .replace(/MVP 测试：/g, '<strong>MVP 测试：</strong>')
    .replace(/动态调整机制：/g, '<strong>动态调整机制：</strong>')
    .replace(/核心结论：/g, '<strong>核心结论：</strong>');
}

// 调用聊天API
async function callChatAPI(input, thinkingChainMode) {
  if (!thinkingChainMode) {
    // 常规模式下直接返回API响应
    return new Promise((resolve, reject) => {
      // 检查是否加载了星火API
      if (!window.sparkAPI) {
        reject(new Error('星火API未初始化，请刷新页面重试'));
        return;
      }
      
      // 设置响应回调
      let responseText = '';
      let isComplete = false;
      
      window.sparkAPI.setResponseCallback((content, type, complete) => {
        if (type === 'error') {
          reject(new Error(content));
          return;
        }
        
        responseText = content;
        isComplete = complete;
        
        if (complete) {
          resolve(responseText);
        }
      });
      
      // 发送消息到星火API
      window.sparkAPI.sendMessage(input)
        .catch(error => {
          reject(error);
        });
        
      // 设置超时保护
      setTimeout(() => {
        if (!isComplete) {
          reject(new Error('请求超时，请稍后再试'));
        }
      }, 30000); // 30秒超时
    });
  } else {
    try {
      // 思考链模式：分两个阶段处理
      // 第一阶段：显示正在思考的提示
      const thinkingPromptMessage = {
        role: 'assistant-thinking',
        content: '正在进行深度思考分析...'
      };
      addMessage(thinkingPromptMessage);
      
      // 获取详细思考过程
      let thoughtProcess = await new Promise((resolve, reject) => {
        if (!window.sparkAPI) {
          reject(new Error('星火API未初始化，请刷新页面重试'));
          return;
        }
        
        let responseText = '';
        let isComplete = false;
        
        window.sparkAPI.setResponseCallback((content, type, complete) => {
          if (type === 'error') {
            reject(new Error(content));
            return;
          }
          
          responseText = content;
          isComplete = complete;
          
          if (complete) {
            resolve(responseText);
          }
        });
        
        window.sparkAPI.sendMessage(input)
          .catch(error => {
            reject(error);
          });
          
        setTimeout(() => {
          if (!isComplete) {
            reject(new Error('思考过程请求超时，请稍后再试'));
          }
        }, 30000);
      });
      
      // 移除思考中的提示消息
      removeMessage(thinkingPromptMessage);
      
      // 添加思考过程的可视化标记
      let visibleThoughtProcess = `<div class="thought-process-container">
        <div class="thought-process-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="thinking-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="16.01"></line>
            <line x1="12" y1="8" x2="12" y2="12"></line>
          </svg>
          <span>思考过程</span>
          <button class="toggle-thought-btn" onclick="toggleThoughtProcess(this)">收起</button>
        </div>
        <div class="thought-process-content">${thoughtProcess}</div>
      </div>`;
      
      // 显示思考过程的结果
      addMessage({
        role: 'assistant',
        content: visibleThoughtProcess
      });
      
      // 等待一小段时间，确保思考过程已完全显示
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 显示正在生成总结的提示
      const summaryPromptMessage = {
        role: 'assistant-thinking',
        content: '正在总结思考过程...'
      };
      addMessage(summaryPromptMessage);
      
      try {
        // 第二阶段：请求对思考过程的总结
        let summaryPrompt = `请对下面的思考过程进行简洁总结，提炼出核心结论和关键要点：\n\n${thoughtProcess}`;
        
        let summary = await new Promise((resolve, reject) => {
          let summaryText = '';
          let isComplete = false;
          let timeoutId = null;
          
          window.sparkAPI.setResponseCallback((content, type, complete) => {
            if (type === 'error') {
              reject(new Error(content));
              return;
            }
            
            summaryText = content;
            isComplete = complete;
            
            if (complete) {
              if (timeoutId) clearTimeout(timeoutId);
              resolve(summaryText);
            }
          });
          
          window.sparkAPI.sendMessage(summaryPrompt)
            .catch(error => {
              reject(error);
            });
            
          // 设置超时保护
          timeoutId = setTimeout(() => {
            if (!isComplete) {
              reject(new Error('总结请求超时，但您仍可查看完整思考过程'));
            }
          }, 25000); // 25秒超时
        });
        
        // 删除"正在总结"的提示消息
        removeMessage(summaryPromptMessage);
        
        // 添加总结的可视化标记
        let visibleSummary = `<div class="summary-container">
          <div class="summary-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="summary-icon">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>结论总结</span>
          </div>
          <div class="summary-content">${summary}</div>
        </div>`;
        
        // 显示总结内容
        addMessage({
          role: 'assistant',
          content: visibleSummary
        });
      } catch (error) {
        // 删除"正在总结"的提示消息
        removeMessage(summaryPromptMessage);
        
        // 显示总结失败的消息
        addMessage({
          role: 'assistant',
          content: `<div class="summary-container">
            <div class="summary-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="summary-icon">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <span>结论总结</span>
            </div>
            <div class="summary-content">
              <p>很抱歉，总结过程遇到了问题：${error.message}</p>
              <p>您可以查看上方的完整思考过程，或者重新提问。</p>
            </div>
          </div>`
        });
      }
      
      // 不返回任何内容，因为我们已经主动添加了消息
      return null;
    } catch (error) {
      // 主要思考过程出错，向上抛出错误，由调用者处理
      throw error;
    }
  }
}

// 移除特定消息
function removeMessage(messageToRemove) {
  // 从数组中移除
  const index = messages.findIndex(msg => msg === messageToRemove);
  if (index !== -1) {
    messages.splice(index, 1);
  }
  
  // 从DOM中移除
  const messageItems = messagesList.querySelectorAll('.message-item');
  const messageItem = Array.from(messageItems).find(item => {
    return item.textContent.includes(messageToRemove.content);
  });
  
  if (messageItem) {
    messagesList.removeChild(messageItem);
  }
}

// 切换思考链模式
function toggleThinkingChainMode() {
  isThinkingChainMode = !isThinkingChainMode;
  
  if (isThinkingChainMode) {
    thinkingChainToggle.classList.add('active');
    messageInput.placeholder = "使用深度思考推理链模式提问...";
  } else {
    thinkingChainToggle.classList.remove('active');
    messageInput.placeholder = "输入您的问题...";
  }
  
  updateThinkingChainStatus();
}

// 更新思考链模式状态显示
function updateThinkingChainStatus() {
  thinkingModeStatus.textContent = isThinkingChainMode ? '(已启用)' : '';
}

// 设置加载状态
function setLoading(loading) {
  isLoading = loading;
  sendButton.disabled = loading || messageInput.value.trim() === '';
  
  if (loading) {
    sendIcon.classList.add('hidden');
    loadingIcon.classList.remove('hidden');
  } else {
    sendIcon.classList.remove('hidden');
    loadingIcon.classList.add('hidden');
  }
}

// 处理滚动事件
function handleScroll() {
  const { scrollTop, scrollHeight, clientHeight } = conversationContainer;
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
  
  // 检测滚动方向
  const isScrollingDown = scrollTop > lastScrollTop;
  lastScrollTop = scrollTop;
  
  if (isNearBottom) {
    scrollToBottomButton.classList.add('hidden');
  } else if (!isScrollingDown) {
    scrollToBottomButton.classList.remove('hidden');
  }
}

// 滚动到底部
function scrollToBottom() {
  // 平滑滚动，但是在移动设备上性能可能不佳，所以根据设备性能调整
  const useSmooth = window.innerWidth > 768 || window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  
  messagesEnd.scrollIntoView({ 
    behavior: useSmooth ? 'smooth' : 'auto'
  });
}

// HTML转义帮助函数
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 创建一个空的SVG图标文件
function createLogo() {
  const logoSvg = document.createElement('a');
  logoSvg.href = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"%3E%3Crect width="32" height="32" rx="8" fill="%234F46E5"/%3E%3Cpath d="M10 10H22M10 16H22M10 22H22" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E';
  logoSvg.download = 'logo.svg';
  document.body.appendChild(logoSvg);
  logoSvg.click();
  document.body.removeChild(logoSvg);
}

// 切换思考过程的显示/隐藏
function toggleThoughtProcess(button) {
  const content = button.parentElement.nextElementSibling;
  content.classList.toggle('collapsed');
  
  if (content.classList.contains('collapsed')) {
    button.textContent = '展开';
  } else {
    button.textContent = '收起';
  }
}

// 帮助提示窗功能
document.addEventListener('DOMContentLoaded', function() {
  // 获取帮助相关元素
  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');
  const closeHelp = document.getElementById('close-help');
  const exampleQuestions = document.querySelectorAll('.example-question');
  
  // 显示帮助提示窗
  helpButton.addEventListener('click', function() {
    helpModal.classList.remove('hidden');
  });
  
  // 关闭帮助提示窗
  closeHelp.addEventListener('click', function() {
    helpModal.classList.add('hidden');
  });
  
  // 点击提示窗背景也可关闭
  helpModal.addEventListener('click', function(event) {
    if (event.target === helpModal) {
      helpModal.classList.add('hidden');
    }
  });
  
  // 点击示例问题，填入输入框并关闭提示窗
  exampleQuestions.forEach(function(questionEl) {
    questionEl.addEventListener('click', function() {
      const question = this.getAttribute('data-question');
      const messageInput = document.getElementById('message-input');
      
      messageInput.value = question;
      messageInput.focus();
      messageInput.dispatchEvent(new Event('input')); // 触发输入事件以激活发送按钮
      
      helpModal.classList.add('hidden');
    });
  });
});

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', init); 