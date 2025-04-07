// app/routes/api.draft-order.create.jsx

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("[API] Draft Order Creation - Request received");
  
  try {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      console.log("[API] Draft Order Creation - Handling OPTIONS request");
      return new Response("", {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    
    // Get the shop query param from the request URL
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    console.log(`[API] Draft Order Creation - Shop parameter: ${shop}`);
    
    if (!shop) {
      console.log("[API] Draft Order Creation - Error: Missing shop parameter");
      return json({ success: false, error: "Shop parameter is required" }, { status: 400 });
    }
    
    console.log("[API] Draft Order Creation - Authenticating with app proxy");
    // Authenticate using offline token for the shop
    const { admin } = await authenticate.public.appProxy(request);
    
    // Parse the request body
    console.log("[API] Draft Order Creation - Parsing request body");
    const requestBody = await request.json();
    console.log("[API] Draft Order Creation - Request body:", JSON.stringify(requestBody));
    
    const { cart } = requestBody;
    
    if (!cart || !cart.items || !cart.items.length) {
      console.log("[API] Draft Order Creation - Error: Cart is empty or invalid", cart);
      return json({ success: false, error: "Cart is empty or invalid" }, { status: 400 });
    }
    
    // Format line items from cart
    console.log("[API] Draft Order Creation - Formatting line items from cart");
    const lineItems = cart.items.map(item => {
      console.log(`[API] Draft Order Creation - Processing item: ${item.title}, variant: ${item.variant_id}, quantity: ${item.quantity}`);
      return {
        variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
        quantity: item.quantity,
      };
    });
    
    // Create the draft order using GraphQL
    console.log("[API] Draft Order Creation - Executing GraphQL mutation");
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
    
    const data = await response.json();
    console.log("[API] Draft Order Creation - GraphQL response:", JSON.stringify(data));
    
    if (data.data.draftOrderCreate.userErrors.length > 0) {
      console.log("[API] Draft Order Creation - GraphQL errors:", JSON.stringify(data.data.draftOrderCreate.userErrors));
      return json({
        success: false,
        error: data.data.draftOrderCreate.userErrors[0].message
      }, { status: 400 });
    }
    
    console.log(`[API] Draft Order Creation - Success! Created draft order: ${data.data.draftOrderCreate.draftOrder.id}`);
    return json({
      success: true,
      draftOrderId: data.data.draftOrderCreate.draftOrder.id
    });
  } catch (error) {
    console.error("[API] Draft Order Creation - Unhandled error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};