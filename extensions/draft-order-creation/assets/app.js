// /extensions/your-extension-name/assets/app.js

(function() {
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[Theme Extension] Initializing draft order creator');
    
    const createBtn = document.getElementById('create-draft-order-btn');
    const resultDiv = document.getElementById('draft-order-result');
    const shopDomain = document.getElementById('draft-order-creator').dataset.shop;
    
    if (!createBtn) {
      console.error('[Theme Extension] Button element not found');
      return;
    }
    
    console.log(`[Theme Extension] Setup complete for shop: ${shopDomain}`);
    
    // Function to get the current "You Pay" value
    function getYouPayAmount() {
      // Find the "You Pay" element in the page
      const youPayElement = document.querySelector('.youpay .red-price .price-bold');
      
      if (!youPayElement) {
        console.warn('[Theme Extension] Could not find You Pay element in the page');
        return null;
      }
      
      // Get the text content (e.g., "$39.40 USD")
      const priceText = youPayElement.textContent.trim();
      console.log(`[Theme Extension] You Pay amount found: "${priceText}"`);
      
      // Extract the numeric value using regex
      const priceMatch = priceText.match(/[\d.]+/);
      if (!priceMatch) {
        console.warn(`[Theme Extension] Could not parse price from text: "${priceText}"`);
        return null;
      }
      
      // Convert to numeric value
      const priceValue = parseFloat(priceMatch[0]);
      console.log(`[Theme Extension] Parsed You Pay amount: ${priceValue}`);
      
      return priceValue;
    }
    
    // Set up a MutationObserver to watch for changes to the "You Pay" element
    function setupPriceObserver() {
      const youPayContainer = document.querySelector('.youpay');
      if (!youPayContainer) {
        console.warn('[Theme Extension] Could not find You Pay container for observation');
        return;
      }
      
      console.log('[Theme Extension] Setting up observer for You Pay amount changes');
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'subtree') {
            const currentAmount = getYouPayAmount();
            console.log(`[Theme Extension] You Pay amount changed: ${currentAmount}`);
          }
        });
      });
      
      observer.observe(youPayContainer, { 
        childList: true, 
        subtree: true,
        characterData: true
      });
      
      return observer;
    }
    
    // Set up the observer
    const priceObserver = setupPriceObserver();
    
    // Function to get initial You Pay amount
    const initialAmount = getYouPayAmount();
    console.log(`[Theme Extension] Initial You Pay amount: ${initialAmount}`);
    
    createBtn.addEventListener('click', function() {
      console.log('[Theme Extension] Create button clicked');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      
      // Get the current You Pay amount
      const remainingValue = getYouPayAmount();
      console.log(`[Theme Extension] Current You Pay amount for draft order: ${remainingValue}`);
      
      // Check if the amount is valid and greater than zero
      const shouldAddRemainingValue = remainingValue !== null && remainingValue > 0;
      console.log(`[Theme Extension] Should add Remaining Value line item: ${shouldAddRemainingValue} (${remainingValue})`);
      
      // Get cart data
      console.log('[Theme Extension] Fetching cart data');
      fetch('/cart.js')
        .then(response => {
          console.log(`[Theme Extension] Cart fetch response status: ${response.status}`);
          return response.json();
        })
        .then(cart => {
          console.log(`[Theme Extension] Cart data received: ${cart.item_count} items`);
          
          // Prepare request data with the dynamic remaining value
          const requestData = {
            cart: cart,
            shop: shopDomain,
            remainingValue: shouldAddRemainingValue ? remainingValue.toFixed(2) : "0.00",
            addRemainingValueItem: shouldAddRemainingValue
          };
          
          console.log('[Theme Extension] App proxy URL:', `/apps/draft-order/create`);
          console.log('[Theme Extension] Request data:', JSON.stringify(requestData));
          
          // Send to app proxy
          fetch('/apps/draft-order/create', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData)
          })
          .then(response => {
            console.log(`[Theme Extension] App proxy response status: ${response.status}`);
            // Log the response headers
            const headers = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });
            console.log('[Theme Extension] Response headers:', headers);
            
            // Get the raw text first to debug any issues
            return response.text().then(text => {
              console.log('[Theme Extension] Raw response text:', text);
              try {
                // Try to parse the response as JSON
                return JSON.parse(text);
              } catch (error) {
                console.error('[Theme Extension] Failed to parse response as JSON:', error);
                throw new Error('Order Not Created, Try again in a few minutes.');
              }
            });
          })
          .then(data => {
            console.log('[Theme Extension] Response from app proxy:', data);
            
            if (data.success) {
              resultDiv.innerHTML = `<div class="success-message">Draft order created successfully! ID: ${data.draftOrderId}</div>`;
              
              // Update message based on whether custom line item was added
              if (data.customLineItemAdded && shouldAddRemainingValue) {
                resultDiv.innerHTML += `<div class="info-message">A "Remaining Value" line item of $${remainingValue.toFixed(2)} has been added to your draft order.</div>`;
              } else if (!shouldAddRemainingValue) {
                resultDiv.innerHTML += `<div class="info-message">No remaining value to add (You Pay amount is ${remainingValue}).</div>`;
              } else if (data.customLineItemError) {
                resultDiv.innerHTML += `<div class="warning-message">Note: Could not add "Remaining Value" line item (${data.customLineItemError})</div>`;
              }
            } else {
              resultDiv.innerHTML = `<div class="error-message">Error: ${data.error || 'Unknown error'}</div>`;
            }
            resultDiv.style.display = 'block';
            createBtn.disabled = false;
            createBtn.textContent = 'Create Order';
          })
          .catch(error => {
            console.error('[Theme Extension] Error in app proxy request:', error);
            resultDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
            resultDiv.style.display = 'block';
            createBtn.disabled = false;
            createBtn.textContent = 'Create Order';
          });
        })
        .catch(error => {
          console.error('[Theme Extension] Error fetching cart:', error);
          resultDiv.innerHTML = `<div class="error-message">Error fetching cart: ${error.message}</div>`;
          resultDiv.style.display = 'block';
          createBtn.disabled = false;
          createBtn.textContent = 'Create Order';
        });
    });
    
    // Clean up observer when needed
    window.addEventListener('beforeunload', function() {
      if (priceObserver) {
        console.log('[Theme Extension] Disconnecting price observer');
        priceObserver.disconnect();
      }
    });
  });
})();