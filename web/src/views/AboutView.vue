<template>
  <div class="page-head"><div><p class="eyebrow">MEMBER GUIDE</p><h1>成员使用指南</h1><p class="subtitle">从查找会议、完成注册到投稿和设置提醒，按照下面的步骤即可开始使用。</p></div></div>
  <div class="panel-grid">
    <section class="card card-body detail-copy">
      <h2>1. 查找并注册会议</h2>
      <p>进入“会议”后，可在议程和月历之间切换，并按关键词、类别、语言或会议形式筛选。点击“立即注册”会直接打开会议注册页面；点击“查看详情”可以先查看完整时间和会议信息。</p>

      <h2>2. 提交会议</h2>
      <p>在“会议”页面点击“投稿会议”，在弹出的窗口中填写会议标题、类别、语言、注册链接、北京时间和持续时长。投稿后会进入审核队列，管理员通过后才会公开显示。</p>

      <h2>3. 查看审核结果</h2>
      <p>在“我的投稿”中可以查看待审核、已发布或未通过的会议。若管理员留下反馈，也会显示在对应投稿下方。</p>

      <div class="inline">
        <RouterLink class="button" to="/?submit=1">提交会议</RouterLink>
        <RouterLink class="button secondary" to="/submissions">查看我的投稿</RouterLink>
      </div>

      <h2>4. 分享会议回放</h2>
      <p>进入“回放”可浏览已审核的网盘来源。投稿时可以关联日历里的具体会议，也可以手动填写历史会议；同一场会议允许不同成员补充多个来源。若链接或提取码失效，可在来源旁提交反馈。</p>
      <RouterLink class="button secondary" to="/replays">浏览与投稿回放</RouterLink>
    </section>

    <aside class="stack">
      <section class="card card-body detail-copy">
        <h2>5. 设置提醒与身份显示</h2>
        <p>进入“提醒”，选择不提醒、提前 10 分钟、30 分钟、1 小时或 1 天，然后生成个人订阅地址，并在 Google、Outlook 或 Apple Calendar 中通过 URL 添加订阅。</p>
        <p>订阅地址属于个人访问凭证，请勿转发。旋转或撤销后，旧地址会立即失效。</p>
        <p>完整 WQ_ID 默认会显示在排行榜和回放贡献者位置；如需隐藏，可在设置中切换为仅显示开头两个字母，不显示后续数字。</p><RouterLink class="button secondary" to="/calendar-settings">打开成员设置</RouterLink>
      </section>

      <section class="card card-body detail-copy">
        <h2>使用提示</h2>
        <ul>
          <li>网站中的会议时间统一显示为北京时间。</li>
          <li>单场会议可在详情页下载 .ics，也可直接添加到 Google Calendar。</li>
          <li>周期会议在议程中只显示最近一场，可在月历中查看具体日期。</li>
          <li>订阅刷新和提醒触发时间由所使用的日历客户端决定。</li>
        </ul>
      </section>
    </aside>
  </div>
</template>
