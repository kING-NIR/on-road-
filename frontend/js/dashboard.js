/* ============================================
   RoadAssist — dashboard.js
   ============================================ */

/* Live Activity Feed via Socket */
document.addEventListener('DOMContentLoaded', () => {
  const feed = document.getElementById('activityFeed');
  window.addEventListener('requestUpdate', (e) => {
    const { user, serviceType, location, status } = e.detail;
    const icons = { fuel:'⛽', mechanic:'🔧', towing:'🚗', battery:'🔋', tyre:'🛞', sos:'🆘' };
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-icon">${icons[serviceType] || '🔔'}</span>
      <div class="activity-info">
        <span class="activity-user">${user}</span> — ${serviceType} request in ${location}
        <span class="activity-time">Just now</span>
      </div>
      <span class="activity-status ${status === 'completed' ? 'completed' : 'in-progress'}">${status === 'completed' ? '✓' : '⟳'}</span>
    `;
    feed.insertBefore(item, feed.firstChild);
    if (feed.children.length > 8) feed.lastChild.remove();
  });

  /* Load ML insights */
  loadInsights();
});

async function loadInsights() {
  try {
    const data = await fetch(`${ML_BASE}/risk-insights`).then(r => r.json());
    const body = document.getElementById('insightsBody');
    if (!body || !data.insights) return;
    body.innerHTML = data.insights.map(i => `
      <div class="insight-item risk-${i.level}">
        <span class="risk-label">${i.icon} ${i.level.toUpperCase()}</span>
        <p>${i.message}</p>
      </div>
    `).join('');
  } catch { /* Use default content */ }
}
