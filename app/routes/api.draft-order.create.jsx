// Enhanced error handling in api.draft-order.create.jsx
export const action = async ({ request }) => {
    console.log("[API] Draft Order Creation - Request received");
    
    try {
      // Handle CORS preflight requests
      if (request.method === "OPTIONS") {
        console.log("[API] Handling OPTIONS request");
        return new Response("", {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      
      // Log the full request details
      console.log("[API] Request URL:", request.url);
      console.log("[API] Request method:", request.method);
      console.log("[API] Request headers:", Object.fromEntries([...request.headers]));
      
      // Get the shop query param from the request URL
      const url = new URL(request.url);
      const shop = url.searchParams.get("shop");
      console.log("[API] Shop parameter:", shop);
      
      if (!shop) {
        console.error("[API] Missing shop parameter");
        return json({ success: false, error: "Shop parameter is required" }, { status: 400 });
      }
      
      // Log the raw request body for debugging
      const rawBody = await request.text();
      console.log("[API] Raw request body:", rawBody);
      
      let parsedBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (e) {
        console.error("[API] Error parsing request body:", e);
        return json({ success: false, error: "Invalid JSON in request body" }, { status: 400 });
      }
      
      const { cart } = parsedBody;
      console.log("[API] Cart data:", JSON.stringify(cart));
      
      if (!cart || !cart.items || !cart.items.length) {
        console.error("[API] Cart is empty or invalid");
        return json({ success: false, error: "Cart is empty or invalid" }, { status: 400 });
      }
      
      // Authentication
      console.log("[API] Authenticating app proxy request");
      try {
        const { admin } = await authenticate.public.appProxy(request);
        console.log("[API] Authentication successful");
        
        // Format line items from cart
        const lineItems = cart.items.map(item => ({
          variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
          quantity: item.quantity,
        }));
        
        console.log("[API] Line items prepared:", JSON.stringify(lineItems));
        
        // Create the draft order using GraphQL
        console.log("[API] Sending GraphQL mutation for draft order creation");
        const response = await admin.graphql(
          `#graphql
          mutation draftOrderCreate($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              "input": {
                "email": cart.email || "customer@example.com",
                "note": "Created from cart via theme app extension",
                "lineItems": lineItems,
                "customAttributes": [
                  {
                    "key": "source",
                    "value": "theme_app_extension"
                  }
                ]
              }
            },
          },
        );
        
        const responseText = await response.text();
        console.log("[API] GraphQL response text:", responseText);
        
        try {
          const data = JSON.parse(responseText);
          console.log("[API] GraphQL response data:", JSON.stringify(data));
          
          if (data.data.draftOrderCreate.userErrors.length > 0) {
            console.error("[API] GraphQL user errors:", JSON.stringify(data.data.draftOrderCreate.userErrors));
            return json({
              success: false,
              error: data.data.draftOrderCreate.userErrors[0].message
            }, { status: 400 });
          }
          
          console.log("[API] Draft order created successfully");
          return json({
            success: true,
            draftOrderId: data.data.draftOrderCreate.draftOrder.id
          });
        } catch (e) {
          console.error("[API] Error parsing GraphQL response:", e);
          return json({
            success: false,
            error: "Error parsing GraphQL response"
          }, { status: 500 });
        }
      } catch (authError) {
        console.error("[API] Authentication error:", authError);
        return json({ 
          success: false,
          error: "Authentication error: " + authError.message 
        }, { status: 401 });
      }
    } catch (error) {
      console.error("[API] Unhandled error:", error);
      return json({ 
        success: false, 
        error: "Server error: " + error.message 
      }, { status: 500 });
    }
  };