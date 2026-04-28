import { useState, useEffect } from 'react';
import { MessageSquare, Plus, ThumbsUp, Send, Trash2, Edit2, X, Pin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FreeForumProps {
  currentMemberId: string;
  currentMemberName: string;
  isAdmin?: boolean;
}

interface ForumPost {
  id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  author?: { full_name: string };
  comments?: ForumComment[];
  is_pinned?: boolean;
}

interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string };
}

export default function FreeForum({ currentMemberId, currentMemberName, isAdmin }: FreeForumProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [error, setError] = useState('');
  const [commentContent, setCommentContent] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forum_posts')
      .select('*, author:members!author_id(full_name)')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) setPosts(data as any);
    if (error) setError('Gönderiler yüklenirken hata oluştu');
    setLoading(false);
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from('forum_comments')
      .select('*, author:members!author_id(full_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    return data || [];
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.content) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    const { error } = await supabase
      .from('forum_posts')
      .insert([{
        author_id: currentMemberId,
        title: formData.title,
        content: formData.content
      }]);

    if (error) {
      setError('Gönderi oluşturulurken hata oluştu');
    } else {
      setShowNewPost(false);
      setFormData({ title: '', content: '' });
      loadPosts();
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentContent.trim()) return;

    const { error } = await supabase
      .from('forum_comments')
      .insert([{
        post_id: postId,
        author_id: currentMemberId,
        content: commentContent
      }]);

    if (!error) {
      setCommentContent('');
      if (selectedPost) {
        const comments = await loadComments(postId);
        setSelectedPost({ ...selectedPost, comments });
      }
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Bu gönderiyi silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', postId);

    if (!error) {
      setSelectedPost(null);
      loadPosts();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('forum_comments')
      .delete()
      .eq('id', commentId);

    if (!error && selectedPost) {
      const comments = await loadComments(selectedPost.id);
      setSelectedPost({ ...selectedPost, comments });
    }
  };

  const viewPost = async (post: ForumPost) => {
    const comments = await loadComments(post.id);
    setSelectedPost({ ...post, comments });
  };

  const togglePin = async (postId: string, currentPinStatus: boolean) => {
    // KURAL 3: Sabitleme/Pinleme sadece Admin yetkisiyle yapılabilir.
    if (!isAdmin) return; 

    const { error } = await supabase
      .from('forum_posts')
      .update({
        is_pinned: !currentPinStatus,
        pinned_at: !currentPinStatus ? new Date().toISOString() : null,
        pinned_by: !currentPinStatus ? currentMemberId : null
      })
      .eq('id', postId);

    if (!error) {
      loadPosts();
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({ ...selectedPost, is_pinned: !currentPinStatus } as any);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Serbest Kürsü</h2>
        <button
          onClick={() => setShowNewPost(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Gönderi
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showNewPost && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h3 className="text-xl font-semibold mb-4">Yeni Gönderi Oluştur</h3>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">İçerik</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                rows={5}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Paylaş
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewPost(false);
                  setFormData({ title: '', content: '' });
                }}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        {selectedPost ? (
          <div className="p-4 sm:p-6">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                  Geri
                </button>
                <div className="flex gap-2">
                  {/* KURAL 3: Sadece Admin sabitleyebilir */}
                  {isAdmin && (
                    <button
                      onClick={() => togglePin(selectedPost.id, (selectedPost as any).is_pinned || false)}
                      className={`p-2 rounded-lg transition-colors ${
                        (selectedPost as any).is_pinned
                          ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title={(selectedPost as any).is_pinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                  {/* KURAL 3: Yazar VEYA Admin silebilir */}
                  {(selectedPost.author_id === currentMemberId || isAdmin) && (
                    <button
                      onClick={() => handleDeletePost(selectedPost.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-bold text-slate-800">{selectedPost.title}</h3>
                {(selectedPost as any).is_pinned && (
                  <Pin className="w-5 h-5 text-amber-500 fill-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                <span className="font-medium">{selectedPost.author?.full_name}</span>
                <span>•</span>
                <span>{new Date(selectedPost.created_at).toLocaleString('tr-TR')}</span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">{selectedPost.content}</p>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-semibold text-slate-800 mb-4">
                Yorumlar ({selectedPost.comments?.length || 0})
              </h4>

              <div className="space-y-4 mb-4">
                {selectedPost.comments?.map((comment) => (
                  <div key={comment.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-slate-800">{comment.author?.full_name}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {new Date(comment.created_at).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      {/* KURAL 3: Yazar VEYA Admin yorum silebilir */}
                      {(comment.author_id === currentMemberId || isAdmin) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-700">{comment.content}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Yorumunuzu yazın..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment(selectedPost.id)}
                />
                <button
                  onClick={() => handleAddComment(selectedPost.id)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {loading ? (
              <p className="text-center py-8 text-slate-500">Yükleniyor...</p>
            ) : posts.length === 0 ? (
              <p className="text-center py-8 text-slate-500">Henüz gönderi yok</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => viewPost(post)}
                  className="p-4 sm:p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{post.title}</h3>
                    {(post as any).is_pinned && (
                      <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <p className="text-slate-600 mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="font-medium">{post.author?.full_name}</span>
                    <span>•</span>
                    <span>{new Date(post.created_at).toLocaleDateString('tr-TR')}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}