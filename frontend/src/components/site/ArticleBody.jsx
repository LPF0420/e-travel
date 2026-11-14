/**
 * 正文渲染（DESIGN：按 \n\n 分段；行首「## 」渲染小标题）
 *
 * props：content
 *
 * 视觉（首段大字、段落间距、引用、图片圆角）全部由 components.css 的 `.article-body` 控制。
 *
 * 用法：<ArticleBody content={travel.content} />
 */

/**
 * 切段：优先按空行分段，单换行视为段内换行（HTML 折叠为空格）。
 * @param {string} text
 * @returns {string[]}
 */
function splitBlocks(text) {
  const source = String(text || '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!source) return [];
  return source
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 正文。
 * @param {{ content?: string }} props
 * @returns {JSX.Element|null}
 */
export function ArticleBody({ content = '' }) {
  const blocks = splitBlocks(content);
  if (!blocks.length) return null;

  return (
    <div className="article-body">
      {blocks.map((block, index) => {
        if (block.startsWith('## ')) {
          return (
            <h3 className="article-body__heading" key={`h-${index}`}>
              {block.slice(3).trim()}
            </h3>
          );
        }
        if (block.startsWith('> ')) {
          return <blockquote key={`b-${index}`}>{block.slice(2).trim()}</blockquote>;
        }
        return <p key={`p-${index}`}>{block}</p>;
      })}
    </div>
  );
}

export default ArticleBody;
