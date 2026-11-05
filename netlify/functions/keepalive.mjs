// Netlify 定时函数：每日心跳，防止 Supabase 免费项目因闲置被自动暂停
// 部署后由 Netlify 每天 09:00 UTC 自动调用一次
const SUPABASE_URL = 'https://iseblqpggjwzbgwwrzvd.supabase.co';
const ANON_KEY = 'sb_publishable_9XtFvYd2O8vuvjn0nSdlHA_4RPPN8mD';

export default async (request, context) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=count&limit=1`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    });
    return new Response(
      JSON.stringify({ ok: true, status: res.status, time: new Date().toISOString() }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
