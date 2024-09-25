import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../../components/ui/dropdown-menu';
import { Edit, Trash2, MoreHorizontal, ArrowLeft, Copy } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useRestaurantDetails } from '../hooks/useRestaurantDetails';
import { useRestaurantOperations } from '../hooks/useRestaurantOperations';
import { copyRestaurant } from '../../../supabaseClient';

const RestaurantDetails = ({ user, updateLocalRestaurant, deleteLocalRestaurant, addLocalRestaurant }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { restaurant, loading, error } = useRestaurantDetails(id);
  const { deleteRestaurant } = useRestaurantOperations();

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center text-red-500">Error: {error}</div>;
  if (!restaurant) return <div className="text-center">Restaurant not found</div>;

  const isOwner = restaurant.user_id === user.id;

  const handleEdit = () => navigate(`/edit/${restaurant.id}`);
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this restaurant?')) {
      try {
        await deleteRestaurant(restaurant.id);
        deleteLocalRestaurant(restaurant.id);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete restaurant:', error);
        alert('Failed to delete restaurant: ' + error.message);
      }
    }
  };

  const handleCopy = async () => {
    try {
      const copiedRestaurant = await copyRestaurant(user.id, restaurant.id);
      addLocalRestaurant(copiedRestaurant);
      alert('Restaurant copied to your list!');
    } catch (error) {
      console.error('Failed to copy restaurant:', error);
      alert('Failed to copy restaurant: ' + error.message);
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const PriceDisplay = ({ price }) => (
    <span className="text-sm font-semibold">
      {[1, 2, 3].map((value) => (
        <span 
          key={value} 
          className={value <= price ? 'text-black' : 'text-gray-300'}
        >
          €
        </span>
      ))}
    </span>
  );

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="p-0 hover:bg-transparent"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="transition-colors duration-200 text-gray-400 hover:text-gray-500"
          >
            <Copy className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-start">
          <div className="relative h-24 w-24 mr-4 bg-slate-300 rounded-lg overflow-hidden flex items-center justify-center text-2xl font-bold text-white">
            {getInitials(restaurant.name)}
            <div className="absolute bottom-1 left-1">
              {restaurant.to_try ? (
                <Badge className="bg-green-400 text-black font-bold text-[0.5rem] px-2 py-0.5 w-12 h-5 rounded shadow">To Try</Badge>
              ) : restaurant.rating ? (
                <div className="bg-white text-black text-sm font-bold rounded w-8 h-5 flex items-center justify-center shadow">
                  {restaurant.rating.toFixed(1)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex-grow">
            <h2 className="text-lg font-bold mb-2">{restaurant.name}</h2>
            <div className="flex items-center mb-2">
              <PriceDisplay price={restaurant.price} />
            </div>
            <span className="text-gray-600">{restaurant.restaurant_types?.name}</span>
            <span className="mx-2">•</span>
            <span className="text-gray-600 mb-2">{restaurant.cities?.name}</span>
          </div>
        </div>
        {restaurant.notes && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Notes</h3>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{restaurant.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantDetails;