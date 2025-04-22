import React, { useState, useEffect } from 'react';
import { createSubstackPost, getScheduledPosts } from '@/lib/utils/backgroundMessaging';
import './SubstackPoster.css';

/**
 * Interface for scheduled post data
 */
interface ScheduledPost {
  id: string;
  message: string;
  scheduledTime: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

/**
 * A component that allows posting to Substack directly from the extension
 */
const SubstackPoster: React.FC = () => {
  const [message, setMessage] = useState("This is a test that was posted automatically with WriteStack Chrome extension.");
  const [isPosting, setIsPosting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoCloseTab, setAutoCloseTab] = useState<boolean>(true);
  
  // Fetch scheduled posts on component mount and every 3 seconds
  useEffect(() => {
    console.log("Setting up scheduled posts fetch interval");
    fetchScheduledPosts();
    
    // const interval = setInterval(() => {
    //   fetchScheduledPosts();
    // }, 3000);
    
    return () => {
    //   console.log("Clearing scheduled posts fetch interval");
    //   clearInterval(interval);
    };
  }, []);
  
  // Function to fetch scheduled posts
  const fetchScheduledPosts = async () => {
    try {
      console.log("Fetching scheduled posts");
      setFetchError(null);
      const response = await getScheduledPosts();
      console.log("Scheduled posts response:", response);
      
      if (response && response.success && response.posts) {
        setScheduledPosts(response.posts);
        console.log(`Fetched ${response.posts.length} scheduled posts`);
      } else if (response && !response.success) {
        console.error("Error in response:", response.error);
        
        // Handle extension context invalidation specifically
        if (response.error && response.error.includes("Extension context invalidated")) {
          setFetchError("Extension was reloaded. Please refresh the page to reconnect.");
        } else {
          setFetchError(response.error || "Unknown error from background script");
        }
      } else {
        console.error("Invalid response format:", response);
        setFetchError("Invalid response format from background script");
      }
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      
      // Special handling for extension context invalidation
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("Extension context invalidated") || 
          errorMessage.includes("Extension context invalid")) {
        setFetchError("Extension was reloaded. Please refresh the page to reconnect.");
      } else {
        setFetchError(errorMessage);
      }
    }
  };

  // Add reconnect functionality
  const handleReconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Reload the current page to reconnect to the extension
    window.location.reload();
  };

  // Update handlePost with better error handling for context invalidation
  const handlePost = async (e: React.MouseEvent) => {
    // Prevent event propagation
    e.stopPropagation();
    
    try {
      setIsPosting(true);
      setResult(null);
      setStatus("Starting post process...");
      console.log("Starting post process");
      
      // First update status to let user know we're scheduling the post
      setStatus("Scheduling post for 5 seconds from now...");
      console.log("Scheduling post for 5 seconds from now");
      
      // Schedule the post with a 5-second delay, passing the autoCloseTab preference
      console.log("Calling createSubstackPost with message:", message.substring(0, 30) + "...");
      const response = await createSubstackPost(message, 5, autoCloseTab);
      console.log("createSubstackPost response:", response);
      
      if (response.success) {
        if (response.scheduled) {
          setResult({
            success: true,
            message: response.message || 'Post scheduled successfully!'
          });
          setStatus(`Post scheduled successfully! Post ID: ${response.postId}`);
          console.log("Post scheduled successfully with ID:", response.postId);
          
          // Fetch the updated list of scheduled posts
          fetchScheduledPosts();
        } else {
          setResult({
            success: true,
            message: 'Post operation started! Check the Substack tab to see your post.'
          });
          setStatus("Post operation completed successfully!");
          console.log("Post operation completed successfully");
        }
      } else {
        setResult({
          success: false,
          error: response.error || 'Unknown error occurred'
        });
        setStatus("Post operation failed.");
        console.error("Post operation failed:", response.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for extension context invalidation
      if (errorMessage.includes("Extension context invalidated") || 
          errorMessage.includes("Extension context invalid")) {
        setResult({
          success: false,
          error: "Extension was reloaded. Please refresh the page to reconnect."
        });
      } else {
        setResult({
          success: false,
          error: errorMessage
        });
      }
      
      setStatus("Post operation failed with an error.");
      console.error("Post operation failed with error:", errorMessage);
    } finally {
      setIsPosting(false);
    }
  };

  // Handler to stop propagation on all interactive elements
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Calculate time remaining for pending posts
  const getTimeRemaining = (scheduledTime: number) => {
    const now = Date.now();
    const remaining = Math.max(0, scheduledTime - now);
    return Math.ceil(remaining / 1000);
  };

  return (
    <div className="substack-poster" onClick={stopPropagation}>
      <h2>Post to Substack</h2>
      
      <div className="form-group">
        <label htmlFor="message" onClick={stopPropagation}>Message:</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onClick={stopPropagation}
          rows={4}
          disabled={isPosting}
        />
      </div>
      
      <div className="form-options">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={autoCloseTab}
            onChange={(e) => setAutoCloseTab(e.target.checked)}
            disabled={isPosting}
            onClick={stopPropagation}
          />
          <span className="checkbox-text">Automatically close tab after posting</span>
        </label>
      </div>
      
      <button 
        onClick={handlePost} 
        disabled={isPosting || !message.trim()}
        className="post-button"
      >
        {isPosting ? 'Scheduling...' : 'Schedule Background Post (5s)'}
      </button>
      
      <div className="background-info">
        <p>Posts are created in a new background tab without disrupting your current tab.</p>
      </div>
      
      {status && (
        <div className="status" onClick={stopPropagation}>
          {status}
        </div>
      )}
      
      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`} onClick={stopPropagation}>
          {result.success ? result.message : `Error: ${result.error}`}
        </div>
      )}
      
      {isPosting && (
        <div className="instructions" onClick={stopPropagation}>
          <p>Please do not close this extension while posting is in progress.</p>
          <p>Your post will be published automatically in 5 seconds.</p>
          <p>A new Substack tab will be opened in the background without affecting your current tab.</p>
          <p>Check the browser console for detailed logs.</p>
        </div>
      )}
      
      {result?.success && (
        <div className="instructions success" onClick={stopPropagation}>
          <p>Your post has been scheduled!</p>
          <p>The extension will automatically:</p>
          <ul>
            <li>Open a new Substack tab in the background</li>
            <li>Post your message</li>
            {autoCloseTab && <li>Close the tab when finished</li>}
          </ul>
          <p>Your current tab will remain active and unaffected throughout the process.</p>
          <p>Check the browser console for detailed logs.</p>
        </div>
      )}
      
      <div className="scheduled-posts-header" onClick={stopPropagation}>
        <h3>Scheduled Posts</h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            fetchScheduledPosts();
          }}
          className="refresh-button"
          title="Refresh scheduled posts"
        >
          🔄
        </button>
      </div>
      
      {fetchError && (
        <div className="fetch-error" onClick={stopPropagation}>
          Error fetching posts: {fetchError}
          {fetchError.includes("refresh") && (
            <button onClick={handleReconnect} className="reconnect-button">
              Refresh Now
            </button>
          )}
        </div>
      )}
      
      {result?.error?.includes("refresh") && (
        <div className="reconnect-container">
          <button onClick={handleReconnect} className="reconnect-button">
            Refresh to Reconnect
          </button>
          <p className="reconnect-info">
            The extension has been reloaded or updated. Click the button above to refresh the page and reconnect.
          </p>
        </div>
      )}
      
      {scheduledPosts.length > 0 ? (
        <div className="scheduled-posts" onClick={stopPropagation}>
          <div className="posts-list">
            {scheduledPosts.map(post => (
              <div 
                key={post.id} 
                className={`scheduled-post ${post.status}`}
                onClick={stopPropagation}
              >
                <div className="post-time">
                  {formatDate(post.scheduledTime)}
                </div>
                <div className="post-status">
                  {post.status === 'pending' 
                    ? `Pending (${getTimeRemaining(post.scheduledTime)}s)` 
                    : post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                </div>
                <div className="post-message">
                  {post.message.length > 30 ? post.message.substring(0, 30) + '...' : post.message}
                </div>
                {post.error && (
                  <div className="post-error">
                    Error: {post.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-posts" onClick={stopPropagation}>
          No scheduled posts found.
        </div>
      )}
    </div>
  );
};

export default SubstackPoster; 