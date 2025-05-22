// app/routes/webhooks.draft-orders-create.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("[WEBHOOK] Draft order creation webhook received");
  
  try {
    // Log the raw request headers for debugging authentication issues
    const headerMap = {};
    for (const [key, value] of request.headers.entries()) {
      headerMap[key] = value;
    }
    console.log("[WEBHOOK] Headers received:", JSON.stringify(headerMap, null, 2));
    
    // Authenticate the webhook
    console.log("[WEBHOOK] Authenticating webhook...");
    const { payload, admin } = await authenticate.webhook(request);
    console.log("[WEBHOOK] Authentication successful");
    
    // Log key information about the draft order
    console.log("[WEBHOOK] Draft order created:", JSON.stringify({
      id: payload.id,
      name: payload.name,
      total_price: payload.total_price,
      line_items_count: Array.isArray(payload.line_items) ? payload.line_items.length : 0
    }, null, 2));
    
    // Check if the draft order already has a "Remaining Value" line item (very unlikely, but we check anyway)
    let remainingValueExists = false;
    if (Array.isArray(payload.line_items)) {
      remainingValueExists = payload.line_items.some(item => {
        const itemTitle = (item.title || "").toLowerCase();
        return itemTitle.includes("remaining value");
      });
    }
    
    if (remainingValueExists) {
      console.log("[WEBHOOK] Draft order already has a Remaining Value line item, no action needed");
      return json({ success: true, valueAdded: false });
    }
    
    try {
      // Get the draft order ID in the format needed for GraphQL
      const draftOrderId = payload.admin_graphql_api_id || `gid://shopify/DraftOrder/${payload.id}`;
      console.log(`[WEBHOOK] Adding Remaining Value line item to draft order: ${draftOrderId}`);
      
      // Add the custom line item using the GraphQL API
      const mutation = `
        mutation draftOrderAddLineItems {
          draftOrderUpdate(
            id: "${draftOrderId}",
            input: {
              lineItems: [
                {
                  title: "Remaining Value",
                  quantity: 1,
                  originalUnitPrice: "5.00",
                  taxable: false
                }
              ]
            }
          ) {
            draftOrder {
              id
              name
              subtotalPrice
              totalPrice
              lineItems(first: 20) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalUnitPrice
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      console.log(`[WEBHOOK] Executing GraphQL mutation:`, mutation);
      
      const addLineItemResponse = await admin.graphql(mutation);
      
      // Log the raw response
      const responseText = await addLineItemResponse.text();
      console.log(`[WEBHOOK] Raw GraphQL response:`, responseText);
      
      let lineItemResponse;
      try {
        lineItemResponse = JSON.parse(responseText);
      } catch (error) {
        console.error(`[WEBHOOK] Failed to parse GraphQL response as JSON:`, error);
        return json({ error: "Invalid response from Shopify API" }, { status: 500 });
      }
      
      if (lineItemResponse.data?.draftOrderUpdate?.userErrors?.length > 0) {
        console.error(`[WEBHOOK] GraphQL errors encountered:`, JSON.stringify(lineItemResponse.data.draftOrderUpdate.userErrors, null, 2));
        return json({ 
          error: "Failed to add Remaining Value line item", 
          graphqlErrors: lineItemResponse.data.draftOrderUpdate.userErrors 
        }, { status: 500 });
      }
      
      console.log(`[WEBHOOK] Successfully added Remaining Value line item to draft order ${payload.name}`);
      return json({ 
        success: true, 
        valueAdded: true, 
        draftOrderId: payload.id,
        draftOrderName: payload.name
      });
    } catch (error) {
      console.error(`[WEBHOOK] Error in GraphQL operations:`, error);
      console.error(`[WEBHOOK] Error stack:`, error.stack);
      return json({ 
        error: "Failed to add Remaining Value to draft order", 
        errorMessage: error.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`[WEBHOOK] Fatal error in webhook processing:`, error);
    console.error(`[WEBHOOK] Error stack:`, error.stack);
    return json({ 
      error: "Webhook processing failed", 
      errorMessage: error.message
    }, { status: 500 });
  }
};

export default function DraftOrdersCreateWebhook() {
  return null;
}