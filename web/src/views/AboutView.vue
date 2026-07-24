<template>
  <div class="page-head"><div><p class="eyebrow">MEMBER GUIDE</p><h1>成员使用指南</h1><p class="subtitle">从查找和注册会议，到投稿回放、订阅提醒与管理身份显示，按照下面的顺序即可完成常用操作。</p></div></div>

  <div class="guide-list">
    <section class="card card-body guide-step">
      <span class="guide-number">1</span>
      <div class="detail-copy"><h2>查找并注册会议</h2><p>进入“会议”，可在议程和月历之间切换，并按关键词、类别、语言或会议形式筛选。点击“立即注册”会直接打开外部注册页面；点击“查看详情”可以先确认北京时间、会议状态和完整信息。</p></div>
    </section>

    <section class="card card-body guide-step">
      <span class="guide-number">2</span>
      <div class="detail-copy"><h2>提交新会议</h2><p>在“会议”页面点击“投稿会议”，在弹出窗口中填写会议标题、类别、语言、注册链接、北京时间和持续时长。投稿会先进入审核队列，只有管理员通过后才会出现在会议列表中。</p><RouterLink class="button" to="/?submit=1">投稿会议</RouterLink></div>
    </section>

    <section class="card card-body guide-step">
      <span class="guide-number">3</span>
      <div class="detail-copy"><h2>查看审核结果</h2><p>在“我的投稿”中可以分别查看会议投稿和回放投稿，状态包括待审核、已发布、未通过或已下架。管理员留下的审核反馈也会显示在对应记录中。</p><RouterLink class="button secondary" to="/submissions">查看我的投稿</RouterLink></div>
    </section>

    <section class="card card-body guide-step">
      <span class="guide-number">4</span>
      <div class="detail-copy"><h2>浏览与分享会议回放</h2><p>进入“回放”可以浏览已经审核的网盘来源。投稿时既可以关联已有会议场次，也可以手动填写历史会议；同一场会议允许多名成员补充不同链接。遇到链接失效、提取码错误或内容不符时，可在对应来源旁提交反馈。</p><RouterLink class="button secondary" to="/replays">浏览与投稿回放</RouterLink></div>
    </section>

    <section class="card card-body guide-step">
      <span class="guide-number">5</span>
      <div class="detail-copy"><h2>设置提醒与身份显示</h2><p>进入“设置”，选择不提醒、提前 10 分钟、30 分钟、1 小时或 1 天，再生成个人订阅地址，并在 Google、Outlook 或 Apple Calendar 中通过 URL 添加订阅。</p><p>订阅地址相当于个人访问凭证，请勿转发。旋转或撤销后，旧地址会立即失效；实际刷新和提醒时间由所使用的日历客户端决定。</p><p>完整 WQ_ID 默认显示在排行榜和回放贡献者位置。关闭公开显示后，普通成员只能看到开头两个字母，不会看到后续数字；管理员仍可查看完整 ID。</p><RouterLink class="button secondary" to="/calendar-settings">打开成员设置</RouterLink></div>
    </section>

    <section class="card card-body detail-copy guide-tips">
      <h2>使用提示</h2>
      <ul>
        <li>网站中的会议时间统一显示为北京时间。</li>
        <li>单场会议可在详情页下载 .ics，也可直接添加到 Google Calendar。</li>
        <li>周期会议在议程中只显示最近一场，可在月历中查看具体日期。</li>
        <li>网站只保存回放链接和相关信息，不保存视频文件，也不会主动访问网盘内容。</li>
        <li>请勿在会议或回放投稿中填写密码、个人专属链接或内部文件。</li>
      </ul>
    </section>
  </div>
</template>
