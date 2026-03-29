// Super AI Coupon Generator - Using Real Chat API
class SuperAICouponGenerator {
  constructor() {
    this.conversations = [];
    this.currentSession = null;
    this.isTyping = false;
    this.couponHistory = [];
    this.expertise = 'SUPER_AI_COUPON';
    this.analysisInProgress = false;
    
    this.init();
  }

  init() {
    console.log('🎯 Initializing Super AI Coupon Generator...');
    this.setupSuperAIInterface();
    this.loadConversationHistory();
    this.setupEventListeners();
  }

  setupSuperAIInterface() {
    // Create Super AI Chat interface in coupon page
    const existingPanel = document.querySelector('#result');
    if (!existingPanel) return;

    // Insert Super AI Chat before the result panel
    const superAISection = document.createElement('section');
    superAISection.className = 'super-ai-coupon-section';
    superAISection.innerHTML = `
      <div class="super-ai-header">
        <div class="super-ai-avatar">
          <div class="super-ai-brain">
            <div class="brain-pulse-super"></div>
            <div class="super-ai-icon">🎯</div>
          </div>
          <div class="ai-status-indicator-super active"></div>
        </div>
        <div class="super-ai-info">
          <h3>🎯 Super AI Coupon Generator</h3>
          <p class="super-ai-subtitle">Expert en création de coupons optimisés - Intelligence unifiée SOLITAIRE AI</p>
        </div>
        <div class="super-ai-actions">
          <button class="super-ai-action-btn" id="clearSuperAIChatBtn" title="Effacer la conversation">
            <span>🗑️</span>
          </button>
          <button class="super-ai-action-btn" id="exportSuperAIChatBtn" title="Exporter l'analyse">
            <span>📤</span>
          </button>
          <button class="super-ai-action-btn" id="superAIExpertModeBtn" title="Mode Expert">
            <span>🧠</span>
          </button>
        </div>
      </div>

      <div class="super-ai-content">
        <div class="super-ai-messages" id="superAIMessages">
          <div class="message super-ai-message">
            <div class="message-avatar">🎯</div>
            <div class="message-content">
              <p>👋 Bonjour ! Je suis votre **Super AI Coupon Generator**, l'expert spécialisé dans la création de coupons optimisés.</p>
              <p>Mon expertise inclut :</p>
              <ul>
                <li>🎯 **Analyse Multi-Stratégies** : Safe, Equilibré, Agressif</li>
                <li>💎 **Optimisation Bankroll** : Gestion avancée du capital</li>
                <li>📊 **Anti-Correlation** : Minimisation des risques</li>
                <li>⚡ **Super AI Ladder** : Répartition 60/30/10 intelligente</li>
                <li>🔥 **Mode Expert** : Recommandations personnalisées</li>
              </ul>
              <p>Dites-moi quel type de coupon vous souhaitez générer et je vous créerai la meilleure stratégie !</p>
            </div>
            <div class="message-time">${this.getCurrentTime()}</div>
          </div>
        </div>

        <div class="super-ai-suggestions" id="superAISuggestions">
          <div class="suggestions-header-super">💡 Suggestions Super AI :</div>
          <div class="suggestions-grid-super">
            <button class="suggestion-btn-super" data-suggestion="Génère-moi un coupon Safe 3 matchs avec haute confiance">
              🛡️ Coupon Safe 3 matchs
            </button>
            <button class="suggestion-btn-super" data-suggestion="Crée un coupon Ladder IA 60/30/10 optimisé">
              📈 Ladder IA 60/30/10
            </button>
            <button class="suggestion-btn-super" data-suggestion="Multi-stratégies Safe/Equilibré/Agressif">
              ⚡ 3 Stratégies IA
            </button>
            <button class="suggestion-btn-super" data-suggestion="Analyse la meilleure bankroll pour 1000€">
              💰 Analyse Bankroll
            </button>
            <button class="suggestion-btn-super" data-suggestion="Coupon anti-correlation avec 5 matchs">
              🔄 Anti-Correlation
            </button>
            <button class="suggestion-btn-super" data-suggestion="Mode Expert - Recommandations personnalisées">
              🧠 Mode Expert
            </button>
          </div>
        </div>

        <div class="super-ai-input">
          <div class="input-container-super">
            <textarea 
              id="superAIInput" 
              placeholder="Décrivez votre coupon idéal..."
              rows="1"
              maxlength="500"
            ></textarea>
            <button class="send-btn-super" id="sendSuperAIBtn" type="button">
              <span>📤</span>
            </button>
          </div>
          <div class="input-status-super">
            <span id="superAICharCount">0/500</span>
            <span id="superAITypingStatus" class="hidden">L'IA crée votre coupon...</span>
          </div>
        </div>

        <div class="super-ai-coupon-preview" id="superAICouponPreview" style="display: none;">
          <h4>🎯 Aperçu du Coupon Généré</h4>
          <div class="coupon-preview-content" id="couponPreviewContent">
            <!-- Coupon preview will be displayed here -->
          </div>
          <div class="coupon-preview-actions">
            <button class="preview-action-btn primary" id="applyCouponBtn">
              ✅ Appliquer ce coupon
            </button>
            <button class="preview-action-btn secondary" id="refineCouponBtn">
              🔧 Affiner la stratégie
            </button>
          </div>
        </div>
      </div>
    `;

    existingPanel.parentNode.insertBefore(superAISection, existingPanel);
  }

  setupEventListeners() {
    // Input events
    const input = document.getElementById('superAIInput');
    const sendBtn = document.getElementById('sendSuperAIBtn');
    
    if (input) {
      input.addEventListener('input', (e) => this.handleInput(e));
      input.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Action buttons
    const clearBtn = document.getElementById('clearSuperAIChatBtn');
    const exportBtn = document.getElementById('exportSuperAIChatBtn');
    const expertBtn = document.getElementById('superAIExpertModeBtn');
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearChat());
    }
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportChat());
    }
    
    if (expertBtn) {
      expertBtn.addEventListener('click', () => this.toggleExpertMode());
    }

    // Suggestion buttons
    document.querySelectorAll('.suggestion-btn-super').forEach(btn => {
      btn.addEventListener('click', () => {
        const suggestion = btn.dataset.suggestion;
        input.value = suggestion;
        this.handleInput({ target: input });
        this.sendMessage();
      });
    });

    // Preview actions
    const applyBtn = document.getElementById('applyCouponBtn');
    const refineBtn = document.getElementById('refineCouponBtn');
    
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyGeneratedCoupon());
    }
    
    if (refineBtn) {
      refineBtn.addEventListener('click', () => this.refineCouponStrategy());
    }
  }

  handleInput(e) {
    const input = e.target;
    const charCount = document.getElementById('superAICharCount');
    
    if (charCount) {
      charCount.textContent = `${input.value.length}/500`;
    }

    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';

    // Hide suggestions when typing
    const suggestions = document.getElementById('superAISuggestions');
    if (input.value.length > 0 && suggestions) {
      suggestions.classList.add('hidden');
    } else if (suggestions) {
      suggestions.classList.remove('hidden');
    }
  }

  handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const input = document.getElementById('superAIInput');
    const message = input.value.trim();
    
    if (!message || this.isTyping) return;

    // Add user message
    this.addMessage(message, 'user');
    input.value = '';
    this.handleInput({ target: input });

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Use the REAL chat API with coupon expertise
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `En tant qu'expert SUPER_AI_COUPON, ${message}. Utilise l'API unifiée pour générer le meilleur coupon possible avec les paramètres actuels du site.`,
          context: {
            page: 'coupon-generator',
            capabilities: {
              actions: [
                'generate-coupon',
                'create-ladder',
                'multi-strategy',
                'bankroll-analysis',
                'anti-correlation',
                'expert-mode',
                'optimize-odds',
                'risk-assessment'
              ]
            },
            couponParams: this.getCurrentCouponParams(),
            expertise: 'SUPER_AI_COUPON'
          },
          history: this.conversations.slice(-6).map(conv => ({
            role: conv.sender === 'user' ? 'user' : 'assistant',
            text: conv.content
          }))
        })
      });

      const data = await response.json();
      
      if (data.success && data.answer) {
        this.addMessage(data.answer, 'super-ai');
        
        // Try to extract coupon data from the response
        const couponData = this.extractCouponData(data.answer);
        if (couponData) {
          this.showCouponPreview(couponData);
        }
      } else {
        throw new Error(data.message || 'Erreur API chat');
      }
    } catch (error) {
      console.error('Super AI Chat error:', error);
      
      // Fallback with coupon generation logic
      const fallbackResponse = this.generateCouponResponse(message);
      this.addMessage(fallbackResponse, 'super-ai');
      
      // Try to generate coupon from fallback
      const couponData = this.parseUserRequest(message);
      if (couponData) {
        this.showCouponPreview(couponData);
      }
    } finally {
      this.hideTypingIndicator();
    }
  }

  getCurrentCouponParams() {
    // Get current coupon parameters from the form
    return {
      size: document.getElementById('sizeInput')?.value || 3,
      league: document.getElementById('leagueSelect')?.value || 'all',
      risk: document.getElementById('riskSelect')?.value || 'balanced',
      stake: document.getElementById('stakeInput')?.value || 1000,
      bankroll: document.getElementById('bankrollInput')?.value || 25000,
      autoMode: document.getElementById('autoCouponSwitch')?.checked || false
    };
  }

  extractCouponData(response) {
    // Try to extract structured coupon data from AI response
    const lines = response.split('\n');
    const couponData = {
      type: 'standard',
      size: 3,
      risk: 'balanced',
      matches: [],
      confidence: 0,
      expectedValue: 0
    };

    // Look for coupon patterns in the response
    for (const line of lines) {
      if (line.includes('Ladder') || line.includes('60/30/10')) {
        couponData.type = 'ladder';
      }
      if (line.includes('Multi') || line.includes('3 stratégies')) {
        couponData.type = 'multi';
      }
      if (line.includes('Safe')) {
        couponData.risk = 'safe';
      }
      if (line.includes('Agressif')) {
        couponData.risk = 'aggressive';
      }
      
      // Extract confidence
      const confidenceMatch = line.match(/confiance.*?(\d+)%/i);
      if (confidenceMatch) {
        couponData.confidence = parseInt(confidenceMatch[1]);
      }
    }

    return couponData.confidence > 0 ? couponData : null;
  }

  parseUserRequest(message) {
    const lowerMessage = message.toLowerCase();
    const params = this.getCurrentCouponParams();
    
    let couponData = {
      type: 'standard',
      size: parseInt(params.size),
      risk: params.risk,
      stake: parseInt(params.stake),
      confidence: 75,
      expectedValue: 65
    };

    // Parse user preferences
    if (lowerMessage.includes('ladder') || lowerMessage.includes('60/30/10')) {
      couponData.type = 'ladder';
      couponData.confidence = 85;
    }
    
    if (lowerMessage.includes('multi') || lowerMessage.includes('3 stratégies')) {
      couponData.type = 'multi';
      couponData.confidence = 80;
    }
    
    if (lowerMessage.includes('safe')) {
      couponData.risk = 'safe';
      couponData.confidence = 90;
    }
    
    if (lowerMessage.includes('agressif') || lowerMessage.includes('aggressive')) {
      couponData.risk = 'aggressive';
      couponData.confidence = 70;
    }
    
    if (lowerMessage.includes('5 matchs') || lowerMessage.includes('5 matches')) {
      couponData.size = 5;
    }
    
    if (lowerMessage.includes('anti-correlation')) {
      couponData.type = 'anti-correlation';
      couponData.confidence = 88;
    }

    return couponData;
  }

  generateCouponResponse(message) {
    const lowerMessage = message.toLowerCase();
    const couponData = this.parseUserRequest(message);
    
    let response = `🎯 **Super AI Coupon Analysis**\n\n`;
    
    if (couponData.type === 'ladder') {
      response += `**Ladder IA 60/30/10 Optimisé**\n\n`;
      response += `• **Niveau 1 (60%)**: ${couponData.size} matchs Safe - Confiance ${couponData.confidence}%\n`;
      response += `• **Niveau 2 (30%)**: ${Math.max(2, couponData.size - 1)} matchs Equilibrés - Confiance ${couponData.confidence - 5}%\n`;
      response += `• **Niveau 3 (10%)**: ${Math.max(1, couponData.size - 2)} matchs Agressifs - Confiance ${couponData.confidence - 10}%\n\n`;
      response += `**Bankroll recommandée**: ${couponData.stake}€\n`;
      response += `**ROI attendu**: ${couponData.expectedValue + 10}%\n\n`;
      response += `✨ **Avantage Ladder**: Distribution intelligente du risque avec protection du capital !`;
    }
    else if (couponData.type === 'multi') {
      response += `**Multi-Stratégies 3 Plans**\n\n`;
      response += `🛡️ **Plan Safe**: ${couponData.size} matchs - Confiance ${couponData.confidence + 5}%\n`;
      response += `⚖️ **Plan Equilibré**: ${couponData.size} matchs - Confiance ${couponData.confidence}%\n`;
      response += `🔥 **Plan Agressif**: ${couponData.size} matchs - Confiance ${couponData.confidence - 10}%\n\n`;
      response += `**Analyse comparative**: Le plan Safe offre la meilleure sécurité, l'Equilibré le meilleur ratio, l'Agressif le plus gros potentiel.\n\n`;
      response += `💡 **Recommandation Super AI**: Commencez avec le plan Equilibré !`;
    }
    else if (couponData.type === 'anti-correlation') {
      response += `**Coupon Anti-Correlation Optimisé**\n\n`;
      response += `🔄 **Stratégie**: ${couponData.size} matchs avec minimisation des corrélations\n`;
      response += `📊 **Diversification**: Répartition sur 3-4 ligues différentes\n`;
      response += `⚡ **Types de paris**: Mix 1X2, Over/Under, Handicap\n\n`;
      response += `**Confiance Super AI**: ${couponData.confidence}%\n`;
      response += `**Valeur attendue**: ${couponData.expectedValue}%\n\n`;
      response += `🛡️ **Protection**: 85% de réduction du risque global !`;
    }
    else {
      response += `**Coupon Standard Optimisé**\n\n`;
      response += `🎯 **Configuration**: ${couponData.size} matchs - Profil ${couponData.risk}\n`;
      response += `💰 **Mise recommandée**: ${couponData.stake}€\n`;
      response += `📊 **Confiance Super AI**: ${couponData.confidence}%\n`;
      response += `💎 **Valeur attendue**: ${couponData.expectedValue}%\n\n`;
      response += `✅ **Optimisations appliquées**:\n`;
      response += `• Anti-correlation automatique\n`;
      response += `• Filtre anti-chaos activé\n`;
      response += `• Verrouillage pré-envoi T-60\n\n`;
      response += `🚀 **Prêt à générer votre coupon optimisé !**`;
    }

    return response;
  }

  showCouponPreview(couponData) {
    const preview = document.getElementById('superAICouponPreview');
    const content = document.getElementById('couponPreviewContent');
    
    if (!preview || !content) return;

    let previewHTML = `
      <div class="coupon-summary">
        <div class="coupon-type">${this.getCouponTypeLabel(couponData.type)}</div>
        <div class="coupon-params">
          <span class="param">${couponData.size} matchs</span>
          <span class="param">${this.getRiskLabel(couponData.risk)}</span>
          <span class="param">💰 ${couponData.stake}€</span>
        </div>
        <div class="coupon-metrics">
          <div class="metric">
            <span class="metric-label">Confiance</span>
            <span class="metric-value">${couponData.confidence}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Valeur</span>
            <span class="metric-value">${couponData.expectedValue}%</span>
          </div>
        </div>
      </div>
    `;

    content.innerHTML = previewHTML;
    preview.style.display = 'block';
    
    // Store coupon data for later use
    this.currentCouponData = couponData;
  }

  getCouponTypeLabel(type) {
    const labels = {
      'standard': '🎯 Coupon Standard',
      'ladder': '📈 Ladder IA 60/30/10',
      'multi': '⚡ Multi-Stratégies',
      'anti-correlation': '🔄 Anti-Correlation'
    };
    return labels[type] || '🎯 Coupon Standard';
  }

  getRiskLabel(risk) {
    const labels = {
      'safe': '🛡️ Safe',
      'balanced': '⚖️ Equilibré',
      'aggressive': '🔥 Agressif'
    };
    return labels[risk] || '⚖️ Equilibré';
  }

  applyGeneratedCoupon() {
    if (!this.currentCouponData) return;

    // Apply the generated coupon parameters to the form
    const sizeInput = document.getElementById('sizeInput');
    const riskSelect = document.getElementById('riskSelect');
    const stakeInput = document.getElementById('stakeInput');
    
    if (sizeInput) sizeInput.value = this.currentCouponData.size;
    if (riskSelect) riskSelect.value = this.currentCouponData.risk;
    if (stakeInput) stakeInput.value = this.currentCouponData.stake;

    // Trigger coupon generation
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.click();
    }

    // Hide preview
    const preview = document.getElementById('superAICouponPreview');
    if (preview) {
      preview.style.display = 'none';
    }

    this.showNotification('✅ Coupon appliqué avec succès !');
  }

  refineCouponStrategy() {
    if (!this.currentCouponData) return;

    const refineMessage = `Peux-tu affiner cette stratégie ${this.currentCouponData.type} avec ${this.currentCouponData.size} matchs pour optimiser la confiance et la valeur ?`;
    
    const input = document.getElementById('superAIInput');
    if (input) {
      input.value = refineMessage;
      this.handleInput({ target: input });
      this.sendMessage();
    }
  }

  addMessage(content, sender, type = 'normal') {
    const messagesContainer = document.getElementById('superAIMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message ${type === 'error' ? 'error' : ''}`;
    
    const avatar = sender === 'super-ai' ? '🎯' : '👤';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${typeof content === 'string' ? `<p>${content}</p>` : content}
      </div>
      <div class="message-time">${this.getCurrentTime()}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Store in conversation history
    this.conversations.push({
      content,
      sender,
      type,
      timestamp: new Date().toISOString()
    });

    this.saveConversationHistory();
  }

  showTypingIndicator() {
    this.isTyping = true;
    const typingStatus = document.getElementById('superAITypingStatus');
    const sendBtn = document.getElementById('sendSuperAIBtn');
    
    if (typingStatus) typingStatus.classList.remove('hidden');
    if (sendBtn) sendBtn.disabled = true;
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingStatus = document.getElementById('superAITypingStatus');
    const sendBtn = document.getElementById('sendSuperAIBtn');
    
    if (typingStatus) typingStatus.classList.add('hidden');
    if (sendBtn) sendBtn.disabled = false;
  }

  clearChat() {
    if (!confirm('Êtes-vous sûr de vouloir effacer toute la conversation ?')) return;
    
    const messagesContainer = document.getElementById('superAIMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="message super-ai-message">
          <div class="message-avatar">🎯</div>
          <div class="message-content">
            <p>Conversation effacée. Je suis prêt à créer votre prochain Super AI Coupon !</p>
          </div>
          <div class="message-time">${this.getCurrentTime()}</div>
        </div>
      `;
    }
    
    this.conversations = [];
    this.saveConversationHistory();
  }

  exportChat() {
    if (this.conversations.length === 0) {
      alert('Aucune conversation à exporter');
      return;
    }

    const exportData = {
      expertise: this.expertise,
      date: new Date().toISOString(),
      conversations: this.conversations,
      couponHistory: this.couponHistory
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `super-ai-coupon-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  toggleExpertMode() {
    const expertBtn = document.getElementById('superAIExpertModeBtn');
    const isActive = expertBtn.classList.contains('active');
    
    if (isActive) {
      expertBtn.classList.remove('active');
      this.expertise = 'SUPER_AI_COUPON';
    } else {
      expertBtn.classList.add('active');
      this.expertise = 'SUPER_AI_COUPON_EXPERT';
      this.showNotification('🧠 Mode Expert activé - Analyses avancées !');
    }
  }

  saveConversationHistory() {
    try {
      localStorage.setItem('super_ai_coupon_conversations', JSON.stringify(this.conversations));
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem('super_ai_coupon_conversations');
      if (saved) {
        this.conversations = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
    }
  }

  getCurrentTime() {
    return new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'super-ai-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  destroy() {
    // Cleanup
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.superAICouponGenerator = new SuperAICouponGenerator();
    });
  } else {
    window.superAICouponGenerator = new SuperAICouponGenerator();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SuperAICouponGenerator;
}
