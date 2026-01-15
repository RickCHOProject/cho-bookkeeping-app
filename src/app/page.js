'use client';

import React, { useState, useRef, useEffect } from 'react';

// CHO Bookkeeping Assistant - Full Application
// Two modes: Expense Submission (Chris/crew) + Bookkeeper (Sherry)

export default function Home() {
  const [mode, setMode] = useState('bookkeeper');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Welcome to the CHO Bookkeeping Assistant. I can help you categorize transactions, parse settlement statements, and answer questions about where expenses should go.\n\nYou can:\n• Ask me where a transaction should be categorized\n• Upload a PDF (settlement statement, closing doc, Shellpoint statement)\n• View submitted expenses from the team\n\nWhat do you need help with?',
      timestamp: new Date().toISOString(),
      flagged: false
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [flaggedItems, setFlaggedItems] = useState([]);
  const fileInputRef = useRef(null);
  const receiptInputRef = useRef(null);

  // Expense submission state
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submitted expenses
  const [submittedExpenses, setSubmittedExpenses] = useState([]);
  const [queryLog, setQueryLog] = useState([]);

  // Active properties - in production, fetch from database
  const activeProperties = [
    '3845 E Yeager Dr, Gilbert AZ',
    '4570 W Lyn Circle, Tucson AZ',
    '12178 W Bonito Dr (Rental)',
    '965 S Sunnyvale, Mesa AZ',
  ];

  // Load expenses on mount
  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setSubmittedExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !uploadedFile) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      attachment: uploadedFile ? uploadedFile.name : null
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Prepare form data for PDF
      let body;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('message', currentInput);
        formData.append('pdf', uploadedFile);
        formData.append('history', JSON.stringify(messages));
        
        const res = await fetch('/api/chat', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        body = data;
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: currentInput, 
            history: messages,
            submittedExpenses: submittedExpenses
          })
        });
        body = await res.json();
      }

      const assistantMessage = {
        role: 'assistant',
        content: body.response || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        flagged: body.flagged || false,
        flagReason: body.flagReason || null
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Log query
      const logEntry = {
        id: Date.now(),
        query: currentInput,
        response: body.response,
        timestamp: new Date().toISOString(),
        flagged: body.flagged
      };
      setQueryLog(prev => [...prev, logEntry]);

      if (body.flagged) {
        setFlaggedItems(prev => [...prev, logEntry]);
        // Save to database
        await fetch('/api/flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        });
      }

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        flagged: false
      }]);
    }

    setIsLoading(false);
    setUploadedFile(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
    } else {
      alert('Please upload a PDF file');
    }
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setReceiptImage(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setReceiptPreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(null);
      }
    }
  };

  const handleExpenseSubmit = async () => {
    if (!propertyAddress.trim()) {
      alert('Please enter a property address');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('property', propertyAddress);
      formData.append('amount', expenseAmount);
      formData.append('vendor', expenseVendor);
      formData.append('note', expenseNote);
      formData.append('submittedBy', 'Team'); // In production, get from auth
      if (receiptImage) {
        formData.append('receipt', receiptImage);
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setSubmittedExpenses(prev => [data.expense, ...prev]);
        
        // Clear form
        setReceiptImage(null);
        setReceiptPreview(null);
        setPropertyAddress('');
        setExpenseNote('');
        setExpenseAmount('');
        setExpenseVendor('');
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
      } else {
        alert('Failed to submit expense. Please try again.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit expense. Please try again.');
    }

    setIsSubmitting(false);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // EXPENSE SUBMISSION VIEW
  if (mode === 'submit') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#e5e5e5'
      }}>
        <div style={{
          maxWidth: 500,
          margin: '0 auto',
          padding: '24px 16px',
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            paddingBottom: 24,
            borderBottom: '1px solid #262626',
            marginBottom: 24
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20
              }}>📸</div>
              <h1 style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#fff',
                margin: 0,
              }}>Submit Expense</h1>
            </div>
            <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
              Snap receipt + tag property
            </p>
          </div>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => setMode('submit')}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none',
                backgroundColor: '#f59e0b', color: '#000', fontWeight: 600, cursor: 'pointer'
              }}
            >Submit Expense</button>
            <button
              onClick={() => setMode('bookkeeper')}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8,
                border: '1px solid #333', backgroundColor: 'transparent',
                color: '#888', fontWeight: 600, cursor: 'pointer'
              }}
            >Bookkeeper View</button>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div style={{
              backgroundColor: '#22c55e22', border: '1px solid #22c55e',
              borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'center'
            }}>
              <span style={{ fontSize: 24, marginRight: 8 }}>✓</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>Expense submitted!</span>
            </div>
          )}

          {/* Receipt Upload */}
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, marginBottom: 16
          }}>
            <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
              Receipt Photo (optional)
            </label>
            <input
              type="file"
              ref={receiptInputRef}
              onChange={handleReceiptUpload}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
            />
            
            {receiptPreview ? (
              <div style={{ position: 'relative' }}>
                <img src={receiptPreview} alt="Receipt" style={{
                  width: '100%', borderRadius: 8, marginBottom: 8
                }}/>
                <button
                  onClick={() => { setReceiptImage(null); setReceiptPreview(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, width: 32, height: 32,
                    borderRadius: '50%', border: 'none', backgroundColor: '#000000aa',
                    color: '#fff', cursor: 'pointer', fontSize: 18
                  }}
                >×</button>
              </div>
            ) : receiptImage ? (
              <div style={{
                backgroundColor: '#262626', borderRadius: 8, padding: 16,
                textAlign: 'center', marginBottom: 8
              }}>
                <span style={{ fontSize: 32 }}>📄</span>
                <p style={{ margin: '8px 0 0', color: '#888', fontSize: 14 }}>{receiptImage.name}</p>
              </div>
            ) : (
              <button
                onClick={() => receiptInputRef.current?.click()}
                style={{
                  width: '100%', padding: '40px 24px', borderRadius: 12,
                  border: '2px dashed #333', backgroundColor: 'transparent',
                  color: '#888', cursor: 'pointer', fontSize: 16
                }}
              >
                <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📷</span>
                Tap to take photo or upload
              </button>
            )}
          </div>

          {/* Property Address */}
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, marginBottom: 16
          }}>
            <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
              Property Address *
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Type address or select below..."
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 8,
                border: '1px solid #333', backgroundColor: '#0a0a0a',
                color: '#fff', fontSize: 16, marginBottom: 12, boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeProperties.map((prop, i) => (
                <button
                  key={i}
                  onClick={() => setPropertyAddress(prop)}
                  style={{
                    padding: '8px 12px', borderRadius: 6,
                    border: propertyAddress === prop ? '1px solid #f59e0b' : '1px solid #333',
                    backgroundColor: propertyAddress === prop ? '#f59e0b22' : 'transparent',
                    color: propertyAddress === prop ? '#f59e0b' : '#888',
                    cursor: 'pointer', fontSize: 13
                  }}
                >{prop.split(',')[0]}</button>
              ))}
            </div>
          </div>

          {/* Amount & Vendor */}
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, marginBottom: 16
          }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
                  Amount
                </label>
                <input
                  type="text"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="$0.00"
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 8,
                    border: '1px solid #333', backgroundColor: '#0a0a0a',
                    color: '#fff', fontSize: 16, boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
                  Vendor
                </label>
                <input
                  type="text"
                  value={expenseVendor}
                  onChange={(e) => setExpenseVendor(e.target.value)}
                  placeholder="Home Depot, etc."
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 8,
                    border: '1px solid #333', backgroundColor: '#0a0a0a',
                    color: '#fff', fontSize: 16, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              placeholder="e.g., Flooring materials, Paint, etc."
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 8,
                border: '1px solid #333', backgroundColor: '#0a0a0a',
                color: '#fff', fontSize: 16, boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleExpenseSubmit}
            disabled={!propertyAddress.trim() || isSubmitting}
            style={{
              width: '100%', padding: '18px 24px', borderRadius: 12, border: 'none',
              backgroundColor: propertyAddress.trim() && !isSubmitting ? '#f59e0b' : '#333',
              color: propertyAddress.trim() && !isSubmitting ? '#000' : '#666',
              fontWeight: 700, fontSize: 18,
              cursor: propertyAddress.trim() && !isSubmitting ? 'pointer' : 'not-allowed'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Expense'}
          </button>

          {/* Recent Submissions */}
          {submittedExpenses.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>Recent Submissions</h3>
              {submittedExpenses.slice(0, 5).map((exp, i) => (
                <div key={i} style={{
                  backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 14, color: '#fff' }}>{exp.property?.split(',')[0] || 'Unknown'}</div>
                    <div style={{ fontSize: 14, color: '#f59e0b' }}>{exp.amount || ''}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {exp.vendor || ''} • {formatDate(exp.created_at || exp.date)} • {exp.note || 'No note'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // BOOKKEEPER VIEW
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#e5e5e5'
    }}>
      {/* Admin Toggle */}
      <div 
        onClick={() => setShowAdminPanel(!showAdminPanel)}
        style={{
          position: 'fixed', top: 8, right: 8, width: 12, height: 12,
          borderRadius: '50%',
          backgroundColor: flaggedItems.length > 0 ? '#ef4444' : '#262626',
          cursor: 'pointer', opacity: 0.6, transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.opacity = 1}
        onMouseLeave={(e) => e.target.style.opacity = 0.6}
      />

      {/* Admin Panel */}
      {showAdminPanel && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: 400, height: '100vh',
          backgroundColor: '#111', borderLeft: '1px solid #262626',
          padding: 24, overflowY: 'auto', zIndex: 100
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>Admin Panel</h2>
            <button onClick={() => setShowAdminPanel(false)} style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20
            }}>×</button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 12 }}>
              Flagged Items ({flaggedItems.length})
            </h3>
            {flaggedItems.length === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No flagged items</p>
            ) : (
              flaggedItems.map((item, i) => (
                <div key={i} style={{
                  backgroundColor: '#1a1a1a', border: '1px solid #ef444433',
                  borderRadius: 8, padding: 12, marginBottom: 8
                }}>
                  <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>{item.flagReason || 'Flagged'}</div>
                  <div style={{ fontSize: 13, color: '#e5e5e5', marginBottom: 8 }}>{item.query}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{formatTime(item.timestamp)}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 12 }}>
              Submitted Expenses ({submittedExpenses.length})
            </h3>
            {submittedExpenses.slice(0, 10).map((exp, i) => (
              <div key={i} style={{
                backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12,
                marginBottom: 8, borderLeft: '3px solid #f59e0b'
              }}>
                <div style={{ fontSize: 13, color: '#fff' }}>{exp.property}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{exp.vendor} {exp.amount}</div>
                <div style={{ fontSize: 11, color: '#666' }}>
                  {formatDate(exp.created_at || exp.date)} • {exp.submitted_by || exp.submittedBy}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 12 }}>
              Query Log ({queryLog.length})
            </h3>
            {queryLog.slice(-10).reverse().map((log, i) => (
              <div key={i} style={{
                backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 8,
                borderLeft: `3px solid ${log.flagged ? '#ef4444' : '#22c55e'}`
              }}>
                <div style={{ fontSize: 13, color: '#e5e5e5', marginBottom: 4 }}>{log.query || '[PDF Upload]'}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{formatTime(log.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Interface */}
      <div style={{
        maxWidth: 800, margin: '0 auto', padding: '24px 16px',
        display: 'flex', flexDirection: 'column', minHeight: '100vh'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center', paddingBottom: 24,
          borderBottom: '1px solid #262626', marginBottom: 24
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
            }}>🌵</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
              CHO Bookkeeping Assistant
            </h1>
          </div>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
            Transaction Categorization • Settlement Parsing • Expense Tracking
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setMode('bookkeeper')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none',
              backgroundColor: '#22c55e', color: '#000', fontWeight: 600, cursor: 'pointer'
            }}
          >Bookkeeper View</button>
          <button
            onClick={() => setMode('submit')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 8,
              border: '1px solid #333', backgroundColor: 'transparent',
              color: '#888', fontWeight: 600, cursor: 'pointer'
            }}
          >Submit Expense</button>
        </div>

        {/* Submitted Expenses Alert */}
        {submittedExpenses.length > 0 && (
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
            marginBottom: 24, borderLeft: '3px solid #f59e0b'
          }}>
            <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8, fontWeight: 600 }}>
              📋 {submittedExpenses.length} SUBMITTED EXPENSES TO MATCH
            </div>
            <div style={{ fontSize: 13, color: '#888' }}>
              Team has submitted receipts. Ask "show me submitted expenses" to see them.
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16
            }}>
              <div style={{
                maxWidth: '85%',
                backgroundColor: msg.role === 'user' ? '#22c55e' : '#1a1a1a',
                color: msg.role === 'user' ? '#fff' : '#e5e5e5',
                borderRadius: 16,
                borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                borderTopLeftRadius: msg.role === 'user' ? 16 : 4,
                padding: '12px 16px', position: 'relative'
              }}>
                {msg.flagged && (
                  <div style={{
                    position: 'absolute', top: -8, right: -8, width: 16, height: 16,
                    borderRadius: '50%', backgroundColor: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
                  }}>!</div>
                )}
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                <div style={{
                  fontSize: 11,
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#666',
                  marginTop: 8, textAlign: 'right'
                }}>{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{
                backgroundColor: '#1a1a1a', borderRadius: 16,
                borderTopLeftRadius: 4, padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e',
                      animation: `pulse 1s infinite ${i * 0.2}s`
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* File Preview */}
        {uploadedFile && (
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <span style={{ fontSize: 14, color: '#e5e5e5' }}>{uploadedFile.name}</span>
            </div>
            <button onClick={() => setUploadedFile(null)} style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18
            }}>×</button>
          </div>
        )}

        {/* Input */}
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: 16, padding: 8,
          display: 'flex', alignItems: 'flex-end', gap: 8
        }}>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              backgroundColor: '#262626', color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}
          >📎</button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about a transaction, vendor, or upload a settlement statement..."
            style={{
              flex: 1, backgroundColor: 'transparent', border: 'none', color: '#e5e5e5',
              fontSize: 14, padding: '12px 8px', resize: 'none', outline: 'none',
              minHeight: 44, maxHeight: 120, lineHeight: 1.5
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && !uploadedFile}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              backgroundColor: input.trim() || uploadedFile ? '#22c55e' : '#262626',
              color: input.trim() || uploadedFile ? '#fff' : '#666',
              cursor: input.trim() || uploadedFile ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}
          >↑</button>
        </div>

        <div style={{ textAlign: 'center', paddingTop: 16, fontSize: 12, color: '#444' }}>
          Powered by Claude • CHO, Flip Co, Big Cactus Holdings
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
