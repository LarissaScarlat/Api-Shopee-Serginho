import crypto from "crypto";
import axios from "axios";
import fs from "fs";

export async function getOrderDetail(order_sn) {
  const config = JSON.parse(fs.readFileSync("tokens.json", "utf8"));

  const partner_id = Number(process.env.PARTNER_ID);
  const shop_id = config.shop_id;
  const access_token = config.access_token;
  const partner_key = process.env.PARTNER_KEY;

  const path = "/api/v2/order/get_order_detail";
  const timestamp = Math.floor(Date.now() / 1000);

  const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
  const sign = crypto
    .createHmac("sha256", partner_key)
    .update(baseString)
    .digest("hex");

  const url =
    `${process.env.ORDER_URL}${path}` +
    `?partner_id=${partner_id}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}` +
    `&access_token=${access_token}` +
    `&shop_id=${shop_id}`;

  const body = {
    order_sn_list: [order_sn],
    response_optional_fields: "buyer_cancel_reason,recipient_address,item_list,package_list,payment_method"
  };

  const response = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" }
  });

  return response.data.response.order_list[0];
}


