// Extend Date prototype for relative time formatting
declare global {
 interface Date {
 toRelativeTimeString(): string;
 }
}

Date.prototype.toRelativeTimeString = function(): string {
 const now = new Date();
 const diffInMs = now.getTime() - this.getTime();
 const diffInSeconds = Math.floor(diffInMs / 1000);
 const diffInMinutes = Math.floor(diffInSeconds / 60);
 const diffInHours = Math.floor(diffInMinutes / 60);
 const diffInDays = Math.floor(diffInHours / 24);

 if (diffInSeconds < 60) {
 return 'just now';
 } else if (diffInMinutes < 60) {
 return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
 } else if (diffInHours < 24) {
 return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
 } else if (diffInDays < 30) {
 return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
 } else {
 return this.toLocaleDateString();
 }
};

export {};