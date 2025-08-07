import React, { useState } from 'react';
import { KnowledgeHubService, Article } from '@/services/knowledge/knowledge-hub-service';

const knowledgeHubService = new KnowledgeHubService();

export const KnowledgeHub: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);

  const handleSearch = async () => {
    const articles = await knowledgeHubService.searchArticles(query);
    setResults(articles);
  };

  return (
    <div>
      <h1>Knowledge Hub</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles..."
      />
      <button onClick={handleSearch}>Search</button>
      <div>
        {results.map((article) => (
          <div key={article.id}>
            <h2>{article.title}</h2>
            <p>by {article.author}</p>
            <p>{article.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
