const endpoint = "http://127.0.0.1:3000/api/trpc/analytics.registerCustomer?batch=1";
const payload = {
  0: {
    json: {
      sessionKey: "demo-dashboard-session-20260816",
      name: "عميل تجريبي",
      phone: "+974 5555 0000",
      zone: "الدوحة",
      address: "عنوان تجريبي للعرض داخل لوحة الإشعارات",
    },
  },
};
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});
console.log(await response.text());
if (!response.ok) process.exit(1);
