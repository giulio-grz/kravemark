import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreHorizontal, Star, FileEdit, Plus, Trash2, Globe, Link2 } from 'lucide-react';
import { useRestaurantDetails } from '../hooks/useRestaurantDetails';
import { 
  supabase,
  addBookmark,
  addReview,
  addNote,
  removeRestaurantFromUserList
} from '@/supabaseClient';
import RestaurantMap from './RestaurantMap';
import SocialFeed from './SocialFeed';
import { ScrollArea } from "@/components/ui/scroll-area";

const RestaurantDetails = ({ user, updateLocalRestaurant, deleteLocalRestaurant, addLocalRestaurant }) => {
  const { id, userId: viewingUserId } = useParams();
  const navigate = useNavigate();
  const { restaurant, loading, error, refetch, userBookmark } = useRestaurantDetails(id, viewingUserId);

  const displayedReview = useMemo(() => {
    if (!restaurant?.reviews) return null;
    return viewingUserId ? 
      restaurant.reviews.find(review => review.user_id === viewingUserId) :
      restaurant.reviews.find(review => review.user_id === user.id);
  }, [restaurant?.reviews, viewingUserId, user.id]);

  const userHasRestaurant = useMemo(() => {
    if (!restaurant) return false;
    
    // Check if the current user (not the viewed user) has this restaurant
    const hasReview = restaurant.reviews?.some(review => review.user_id === user.id) || false;
    // Only true if userBookmark is actually present
    const hasBookmark = userBookmark ? true : false;
    
    return hasReview || hasBookmark;
  }, [restaurant, user.id, userBookmark]);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [rating, setRating] = useState(0);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info', confirmed: false });
  const [isOwner, setIsOwner] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    removing: false
  });
  const [hasSocialContent, setHasSocialContent] = useState(false);

  const setLoadingState = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  // Format utilities
  const formatRating = (rating) => {
    return Number.isInteger(rating) ? rating.toFixed(1) : rating.toFixed(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate aggregate rating
  const { aggregateRating, reviewCount, ownerReview } = useMemo(() => {
    if (!restaurant) {
      return { aggregateRating: 0, reviewCount: 0, ownerReview: null };
    }
    
    return {
      aggregateRating: restaurant.aggregate_rating || 0,
      reviewCount: restaurant.review_count || 0,
      ownerReview: restaurant.user_review || null
    };
  }, [restaurant]);

  // Get notes based on the viewing context
  const displayedNote = useMemo(() => {
    if (!restaurant?.notes?.length) return null;
    
    if (viewingUserId && viewingUserId !== user.id) {
      return restaurant.notes.find(note => note.user_id === viewingUserId);
    }
    
    return restaurant.notes.find(note => note.user_id === user.id);
  }, [restaurant?.notes, viewingUserId, user.id]);

  useEffect(() => {
    if (restaurant) {
      setIsOwner(restaurant.created_by === user.id);
      if (displayedNote) {
        setNoteContent(displayedNote.note);
      }
    }
  }, [restaurant, user.id, displayedNote]);

  // Handle import
  const handleImport = async (type) => {
    try {
      if (type === 'to_try') {
        await addBookmark(user.id, restaurant.id, true);
        setAlert({ show: true, message: 'Added to your "To Try" list', type: 'success' });
        setIsImportDialogOpen(false);
        await refetch(); // Make sure this is here
      } else {
        setIsImportDialogOpen(false);
        setIsReviewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error importing restaurant:', error);
      setAlert({ show: true, message: 'Failed to import restaurant', type: 'error' });
    }
  };

  // Handle review
  const handleReviewSubmit = async () => {
    try {
      if (!rating) {
        setAlert({ show: true, message: 'Please set a rating', type: 'error' });
        return;
      }
  
      // First remove the "to try" bookmark if it exists
      if (restaurant.is_to_try) {
        try {
          const { error: removeError } = await supabase
            .from('bookmarks')
            .delete()
            .eq('user_id', user.id)
            .eq('restaurant_id', restaurant.id)
            .eq('type', 'to_try');
  
          if (removeError) {
            console.error('Error removing to try status:', removeError);
            // Continue with the review even if bookmark removal fails
          }
        } catch (err) {
          console.error('Error during bookmark removal:', err);
          // Continue with the review even if bookmark removal fails
        }
      }
  
      // Then add/update the review
      await addReview({
        user_id: user.id,
        restaurant_id: restaurant.id,
        rating: rating
      });
  
      // Force a refresh of the data
      await refetch();
      setIsReviewDialogOpen(false);
      setRating(0);
      setAlert({ 
        show: true, 
        message: ownerReview ? 'Review updated successfully' : 'Review added successfully', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      setAlert({ 
        show: true, 
        message: 'Failed to submit review', 
        type: 'error' 
      });
    }
  };

  // Handle note
  const handleNoteSave = async () => {
    try {
      if (!noteContent.trim()) {
        setAlert({ show: true, message: 'Note cannot be empty', type: 'error' });
        return;
      }
  
      if (displayedNote) {
        const { error: updateError } = await supabase
          .from('notes')
          .update({ note: noteContent })
          .eq('id', displayedNote.id);
  
        if (updateError) throw updateError;
      } else {
        await addNote({
          user_id: user.id,
          restaurant_id: restaurant.id,
          note: noteContent
        });
      }
  
      await refetch();
      setEditingNote(false);
      setAlert({ show: true, message: 'Note saved successfully', type: 'success' });
    } catch (error) {
      console.error('Error saving note:', error);
      setAlert({ show: true, message: 'Failed to save note', type: 'error' });
    }
  };

  const handleDeleteNote = async () => {
    try {
      if (!displayedNote?.id) return;
  
      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', displayedNote.id)
        .eq('user_id', user.id);
  
      if (deleteError) throw deleteError;
  
      setNoteContent('');
      setEditingNote(false);
      await refetch();
      setAlert({ 
        show: true, 
        message: 'Note deleted successfully', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      setAlert({ 
        show: true, 
        message: 'Failed to delete note: ' + error.message, 
        type: 'error' 
      });
    }
  };

  const handleRemoveRestaurant = async () => {
    try {
      setLoadingState('removing', true);

      await removeRestaurantFromUserList(user.id, restaurant.id);
      
      setAlert({ 
        show: true, 
        message: 'Restaurant removed successfully', 
        type: 'success' 
      });
      
      navigate(-1);
    } catch (error) {
      console.error('Error removing restaurant:', error);
      setAlert({ 
        show: true, 
        message: 'Failed to remove restaurant: ' + error.message, 
        type: 'error' 
      });
    } finally {
      setLoadingState('removing', false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (error) return <div className="flex justify-center items-center h-screen">Error: {error}</div>;
  if (!restaurant) return <div className="flex justify-center items-center h-screen">Restaurant not found</div>;

  return (
    <div className="max-w-full pb-20">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="p-0 hover:bg-transparent"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {viewingUserId && 
        viewingUserId !== user.id && 
        !userHasRestaurant && (
          <Button onClick={() => setIsImportDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add to My List
          </Button>
        )}
  
        {(!viewingUserId || viewingUserId === user.id) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => setAlert({
                  show: true,
                  message: 'Are you sure you want to remove this restaurant?',
                  type: 'delete'
                })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove from list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
  
      {/* Restaurant Image/Banner */}
      <div className="relative bg-slate-100 h-64 rounded-xl mb-6 flex items-center justify-center">
        <div className="text-6xl font-bold text-slate-400">
          {restaurant?.name?.substring(0, 2).toUpperCase()}
        </div>
      </div>

      {/* Restaurant Name and Details */}
      <div className="mb-4">
        <h1 className="text-xl font-bold mb-4">{restaurant.name}</h1>
        <div className="flex items-center space-x-2 text-gray-500 text-sm">
          {restaurant?.restaurant_types?.name && (
            <>
              <span>{restaurant.restaurant_types.name}</span>
              <span>•</span>
            </>
          )}
          {restaurant?.cities?.name && (
            <>
              <span>{restaurant.cities.name}</span>
              <span>•</span>
            </>
          )}
          <span>{'€'.repeat(restaurant?.price || 0)}</span>
        </div>
      </div>

      {/* Address */}
      <div className={`text-gray-500 text-sm ${!restaurant?.website ? 'border-b pb-8 mb-8' : 'mb-4'}`}>
        {restaurant?.address}
        {restaurant?.postal_code && `, ${restaurant.postal_code}`}
        {restaurant?.cities?.name && `, ${restaurant.cities.name}`}
      </div>

      {/* Website */}
      {restaurant?.website && (
        <div className="flex items-center space-x-2 text-sm border-b pb-8 mb-8">
          <a 
            href={restaurant.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center"
          >
            <Link2 className="h-4 w-4 mr-2 rotate-[135deg]" />
            Visit Website
          </a>
        </div>
      )}

      {/* Reviews Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 border-b pb-8 mb-8">
        {/* Overall Rating */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Overall Rating</h2>
          {aggregateRating > 0 ? (
            <div>
              <div className="text-3xl font-bold mb-2 flex items-center">
                {formatRating(aggregateRating)}
                <Star className="h-5 w-5 ml-2 text-yellow-400 fill-current" />
              </div>
              <div className="text-sm text-gray-500">
                Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No ratings yet</div>
          )}
        </div>

        {/* Rating Section */}
        {((!viewingUserId || viewingUserId === user.id) || displayedReview) && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {displayedReview ? (
                  viewingUserId && viewingUserId !== user.id ? 
                    `${displayedReview.username}'s Rating` : 
                    "My Rating"
                ) : (
                  "Add Review"
                )}
              </h2>
              {(!viewingUserId || viewingUserId === user.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRating(displayedReview?.rating || 5);
                    setIsReviewDialogOpen(true);
                  }}
                >
                  {displayedReview ? <FileEdit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {displayedReview ? (
              <>
                <div className="text-3xl font-bold mb-2 flex items-center">
                  {formatRating(displayedReview.rating)}
                  <Star className="h-5 w-5 ml-2 text-yellow-400 fill-current" />
                </div>
                <div className="text-sm text-gray-500">
                  Added {formatDate(displayedReview.created_at)}
                </div>
              </>
            ) : (!viewingUserId || viewingUserId === user.id) ? (
              <div className="text-gray-500">Click to add your rating</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Map Section */}
      <div className="border-b pb-8 mb-8">
        <h2 className="text-lg font-semibold mb-4">Location</h2>
        {restaurant?.latitude && restaurant?.longitude ? (
          <RestaurantMap 
            address={restaurant.address}
            city={restaurant.cities?.name}
            latitude={restaurant.latitude}
            longitude={restaurant.longitude}
          />
        ) : restaurant?.status === 'pending' ? (
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center text-muted-foreground">
              <p>Location will be available after admin approval</p>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center text-muted-foreground">
              <p>Location not available</p>
            </div>
          </div>
        )}
      </div>

      {/* Social Feed Section */}
      {userHasRestaurant && (!viewingUserId || viewingUserId === user.id) && 
          <SocialFeed 
            restaurantId={restaurant.id} 
            userId={user.id}
            wrapper={(content) => content && (
              <div className="border-b pb-8 mb-8">
                <h2 className="text-lg font-semibold mb-4">Social Feed</h2>
                {content}
              </div>
            )}
          />
      }

      {/* Notes Section */}
      {(!viewingUserId || viewingUserId === user.id || displayedNote) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Notes</h2>
            {(!viewingUserId || viewingUserId === user.id) && (
              <div className="flex items-center gap-2">
                {displayedNote ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setNoteContent(displayedNote.note);
                        setEditingNote(true);
                      }}
                    >
                      <FileEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAlert({
                          show: true,
                          message: 'Are you sure you want to delete this note?',
                          type: 'delete-note'
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNoteContent('');
                      setEditingNote(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                )}
              </div>
            )}
          </div>
          {editingNote ? (
            <div className="space-y-4">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[100px]"
                placeholder="Write your note here..."
              />
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingNote(false);
                    setNoteContent(displayedNote?.note || '');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleNoteSave}>Save</Button>
              </div>
            </div>
          ) : displayedNote ? (
            <div>
              <p className="whitespace-pre-wrap">{displayedNote.note}</p>
              <p className="text-sm text-gray-500 mt-4">
                Last updated: {formatDate(displayedNote.created_at)}
              </p>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No notes yet. Click 'Add Note' to create one.
            </div>
          )}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog 
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setIsReviewDialogOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Your List</DialogTitle>
            <DialogDescription>
              Choose how you want to add this restaurant to your list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleImport('to_try')}
            >
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">Add to "To Try" List</span>
                <span className="text-sm text-muted-foreground mt-1">
                Save this restaurant to try later
                </span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleImport('review')}
            >
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">Add Review</span>
                <span className="text-sm text-muted-foreground mt-1">
                  I've visited this restaurant and want to add a review
                </span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog 
        open={isReviewDialogOpen}
        onOpenChange={(open) => {
          setIsReviewDialogOpen(open);
          if (!open) {
            setRating(0);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Your Review</DialogTitle>
            <DialogDescription>
              Rate your experience at {restaurant.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center space-x-4">
                <Slider
                  min={0}
                  max={10}
                  step={0.5}
                  value={[rating]}
                  onValueChange={(value) => setRating(value[0])}
                  className="flex-1"
                />
                <div className="w-16 text-right font-medium bg-slate-100 px-2 py-1 rounded">
                  {rating === 10 ? '10' : rating.toFixed(1)}/10
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReviewSubmit}>
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alert.show}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alert.type === 'delete' ? 'Remove Restaurant' : 
              alert.type === 'delete-note' ? 'Delete Note' :
              alert.type === 'error' ? 'Error' : 'Success'}
            </AlertDialogTitle>
            <AlertDialogDescription>{alert.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {(alert.type === 'delete' || alert.type === 'delete-note') ? (
              <>
                <AlertDialogCancel onClick={() => setAlert({ show: false })}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (alert.type === 'delete-note') {
                      await handleDeleteNote();
                    } else if (alert.type === 'delete') {
                      await handleRemoveRestaurant();
                    }
                    setAlert({ show: false });
                  }}
                >
                  {alert.type === 'delete' ? 'Remove' : 'Delete'}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => setAlert({ show: false })}>
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RestaurantDetails;